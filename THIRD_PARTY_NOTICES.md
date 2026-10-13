# Third-party notices

このリポジトリに取り込んだ第三者コードの著作権表示とライセンスを記載します。
ルートの[LICENSE](LICENSE)は、このリポジトリの著作権者が権利を持つコードに適用します。
以下の第三者コードは、それぞれの著作権表示とライセンスを維持します。

## shadcn/ui

- 対象: `packages/ui/src/`のshadcn/ui由来の汎用コンポーネントと補助コード、および`packages/ui/styles.css`のテーマ定義の由来部分
- 上流: [shadcn-ui/ui](https://github.com/shadcn-ui/ui)
- ライセンス: MIT
- [ライセンス本文の確認元](https://github.com/shadcn-ui/ui/blob/6ea6856f5a1082d4d9c231559b6bc3ee73827493/LICENSE.md)

コンポーネントは、このリポジトリの構成・スタイルに合わせて分割・変更しています。
上の固定リンクはライセンス本文の確認元で、コンポーネントの導入コミットを示すものではありません。

```text
MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## TanStack Start

- 対象: `patches/@tanstack__start-server-core@1.169.39.patch`に含まれる上流コードとその変更部分
- 上流: [TanStack/router](https://github.com/TanStack/router)
- 対象バージョン: `@tanstack/start-server-core@1.169.39`
- ライセンス: MIT
- [対象バージョンのライセンス](https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/LICENSE)

このリポジトリでは、入力解析と内部例外の公開範囲を調整するパッチを適用しています。
変更内容はパッチ本体と[ADR 023](docs/adr/023-security-boundaries-and-resource-limits.md)を参照してください。

```text
MIT License

Copyright (c) 2021-present Tanner Linsley

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Cloudflare Workersの生成済みランタイム型

- 対象: `apps/api/worker-configuration.d.ts`、`apps/web/worker-configuration.d.ts`、
  `apps/business/worker-configuration.d.ts`、`apps/admin/worker-configuration.d.ts`のランタイム型
- 生成元: Wrangler / workerd。各ファイルのヘッダーに生成コマンド・バージョンを記録
- ライセンス: Apache License 2.0
- 同梱のライセンス全文: [licenses/Apache-2.0.txt](licenses/Apache-2.0.txt)
- [workerd v1.20260926.1のライセンス](https://github.com/cloudflare/workerd/blob/da46ad950c54b19158c5ea5cb997a9727491ca17/LICENSE)

各ファイルに含まれる以下の著作権表示と、個別の型定義に付された著作権・ライセンス表示を維持します。
プロジェクト固有のバインディング定義は、各アプリの設定から生成されます。

```text
Copyright (c) Cloudflare. All rights reserved.
Copyright (c) Microsoft Corporation. All rights reserved.
```

## パッケージ依存と再配布

`package.json`、各ワークスペースの`package.json`、`pnpm-lock.yaml`に記載された依存パッケージには、
それぞれのライセンスが適用されます。この文書は、依存パッケージや配布ビルドに含まれる全ライセンスの一覧ではありません。

ソース、切り出したアプリ、共有パッケージ、ビルド成果物を再配布するときは、
含まれる第三者コードのライセンス・著作権表示・必要なNOTICEを確認し、一緒に配布してください。
