const RESOURCE_PREFIX = "dev-template-pr-";
const RESOURCE_PAGE_SIZE = 100;
const IMAGE_PAGE_SIZE = 100;

export function previewResourceNames(id) {
  if (!/^[1-9]\d*$/.test(String(id))) {
    throw new Error("PR番号が不正です");
  }

  const prefix = `${RESOURCE_PREFIX}${id}`;
  return { database: `${prefix}-db`, bucket: `${prefix}-images`, queue: `${prefix}-events` };
}

export function cloudflareApi(environment, fetcher = fetch) {
  const account = environment.CLOUDFLARE_ACCOUNT_ID;
  const token = environment.CLOUDFLARE_API_TOKEN;
  if (!/^[a-f0-9]{32}$/i.test(account ?? "") || !token) {
    throw new Error("Preview用Cloudflare資格情報が必要です");
  }

  return async (path, method = "GET", body) => {
    const response = await fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${account}${path}`,
      {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    if (response.status === 404 && ["GET", "DELETE"].includes(method)) {
      return null;
    }

    const data = await response.json();
    // Provider本文や資格情報を例外に載せず、CIログへの漏えいを防ぐ。
    if (!response.ok || !data.success) {
      throw new Error(`Previewリソース操作に失敗しました (${method}, HTTP ${response.status})`);
    }

    return data;
  };
}

async function findNamed(api, endpoint, field, name) {
  for (let page = 1; ; page++) {
    const data = await api(`${endpoint}?page=${page}&per_page=${RESOURCE_PAGE_SIZE}`);
    const entries = data?.result ?? [];
    const found = entries.find((entry) => entry[field] === name);
    if (found) {
      return found;
    }

    if (
      entries.length < RESOURCE_PAGE_SIZE ||
      page >= (data.result_info?.total_pages ?? Infinity)
    ) {
      return null;
    }
  }
}

export async function provisionPreviewResources(id, api) {
  const names = previewResourceNames(id);
  const database =
    (await findNamed(api, "/d1/database", "name", names.database)) ??
    (await api("/d1/database", "POST", { name: names.database })).result;
  const bucket = await api(`/r2/buckets/${names.bucket}`);
  if (!bucket) {
    await api("/r2/buckets", "POST", { name: names.bucket });
  }

  const queue =
    (await findNamed(api, "/queues", "queue_name", names.queue)) ??
    (await api("/queues", "POST", { queue_name: names.queue })).result;
  if (database.name !== names.database || queue.queue_name !== names.queue) {
    throw new Error("Previewリソースの名前が一致しません");
  }

  return { ...names, databaseId: database.uuid };
}

export async function deletePreviewResources(id, api, deleteObject) {
  const names = previewResourceNames(id);
  const database = await findNamed(api, "/d1/database", "name", names.database);
  const bucket = await api(`/r2/buckets/${names.bucket}`);
  if (database && bucket) {
    await emptyImageBucket(api, database.uuid, names.bucket, deleteObject);
  }

  if (bucket) {
    await api(`/r2/buckets/${names.bucket}`, "DELETE");
  }

  const queue = await findNamed(api, "/queues", "queue_name", names.queue);
  if (queue) {
    await api(`/queues/${queue.queue_id}`, "DELETE");
  }

  if (database) {
    await api(`/d1/database/${database.uuid}`, "DELETE");
  }
}

// Worker停止後に、アップロード前に保存した画像キーを使って専用バケットを空にする。
async function emptyImageBucket(api, databaseId, bucket, deleteObject) {
  const table = await api(`/d1/database/${databaseId}/query`, "POST", {
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='product_images'",
  });
  if (!table.result[0].results.length) {
    return;
  }

  for (let offset = 0; ; offset += IMAGE_PAGE_SIZE) {
    const data = await api(`/d1/database/${databaseId}/query`, "POST", {
      sql: "SELECT image_key FROM product_images ORDER BY id LIMIT ? OFFSET ?",
      params: [IMAGE_PAGE_SIZE, offset],
    });
    const rows = data.result[0].results;
    await deleteImageRows(bucket, rows, deleteObject);
    if (rows.length < IMAGE_PAGE_SIZE) {
      break;
    }
  }
}

async function deleteImageRows(bucket, rows, deleteObject) {
  for (const row of rows) {
    if (!deleteObject) {
      throw new Error("R2オブジェクトの削除処理が必要です");
    }

    await deleteObject(bucket, row.image_key);
  }
}
