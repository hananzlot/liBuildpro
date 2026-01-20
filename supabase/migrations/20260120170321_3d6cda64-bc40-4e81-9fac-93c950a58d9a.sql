
-- Update contact's custom_fields with the address from GHL
UPDATE contacts 
SET custom_fields = COALESCE(custom_fields, '[]'::jsonb) || '[{"id": "b7oTVsUQrLgZt84bHpCn", "value": "701 Bubbling Well Drive, Glendora, California 91741"}]'::jsonb,
    updated_at = NOW()
WHERE ghl_id = '7xzizldrlmaapMvQTqba';
