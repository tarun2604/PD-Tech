-- Create logs table
CREATE TABLE IF NOT EXISTS public.logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies for logs
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Policy to allow admins to view all logs
CREATE POLICY "Admins can view all logs" ON public.logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Policy to allow users to view their own logs
CREATE POLICY "Users can view their own logs" ON public.logs
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Policy to allow admins to insert logs
CREATE POLICY "Admins can insert logs" ON public.logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Create index on user_id for better query performance
CREATE INDEX logs_user_id_idx ON public.logs(user_id);

-- Create index on created_at for better query performance
CREATE INDEX logs_created_at_idx ON public.logs(created_at); 