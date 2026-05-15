-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'compliance-documents',
    'compliance-documents',
    false,
    52428800,  -- 50MB limit
    ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload own documents" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'compliance-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can read own documents" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'compliance-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );
