import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get contacts from Location 2 that have attributions with utmContent
    const { data: contacts, error: fetchError } = await supabase
      .from('contacts')
      .select('ghl_id, contact_name, attributions, custom_fields')
      .eq('location_id', 'XYDIgpHivVWHii65sId5');
    
    if (fetchError) throw fetchError;
    
    console.log(`Found ${contacts?.length || 0} contacts from Location 2`);
    
    const updates: Array<{ ghl_id: string; name: string; scope: string }> = [];
    
    for (const contact of contacts || []) {
      // Extract utmContent from attributions
      let utmContent = '';
      if (Array.isArray(contact.attributions)) {
        const firstAttribution = contact.attributions.find((a: any) => a.utmContent);
        utmContent = firstAttribution?.utmContent || '';
      }
      
      if (utmContent) {
        // Update custom_fields with the scope
        const newCustomFields = [
          { id: 'KwQRtJT0aMSHnq3mwR68', value: utmContent }
        ];
        
        const { error: updateError } = await supabase
          .from('contacts')
          .update({ custom_fields: newCustomFields })
          .eq('ghl_id', contact.ghl_id);
        
        if (updateError) {
          console.error(`Failed to update ${contact.contact_name}:`, updateError);
        } else {
          updates.push({ ghl_id: contact.ghl_id, name: contact.contact_name, scope: utmContent });
          console.log(`Updated ${contact.contact_name} with scope: ${utmContent}`);
        }
      }
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      updated: updates.length,
      details: updates 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
