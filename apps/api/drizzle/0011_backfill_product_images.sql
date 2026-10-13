-- Preserve the legacy primary pointer and original object keys without touching R2.
-- A deterministic product-specific ID also preserves legacy keys shared by products.
INSERT INTO product_images (id, tenant_id, product_id, image_key, state, created_at)
SELECT 'legacy:' || id, tenant_id, id, image_key, 'active', created_at
FROM products WHERE image_key IS NOT NULL;
