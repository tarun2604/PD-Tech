import { supabase } from '../supabaseClient';

export const logAction = async (
    userId: string,
    action: string,
    details: string,
    relatedId?: string
) => {
    try {
        const { error } = await supabase
            .from('logs')
            .insert([
                {
                    user_id: userId,
                    action,
                    details,
                    related_id: relatedId
                }
            ]);

        if (error) {
            console.error('Error logging action:', error);
        }
    } catch (error) {
        console.error('Error logging action:', error);
    }
}; 