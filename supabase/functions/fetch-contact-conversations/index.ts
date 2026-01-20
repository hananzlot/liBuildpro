import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  id: string;
  body: string;
  direction: string;
  status: string;
  type: string;
  dateAdded: string;
  attachments?: any[];
}

// Helper to get GHL credentials from database - returns null if not configured
async function getGHLCredentials(supabase: any, locationId: string): Promise<{ apiKey: string; locationId: string } | null> {
  if (!locationId || locationId === 'local') {
    return null;
  }

  const { data: integration, error } = await supabase
    .from("company_integrations")
    .select("id, location_id, api_key_encrypted")
    .eq("provider", "ghl")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .single();

  if (error || !integration || !integration.api_key_encrypted) {
    console.error(`GHL integration not configured for location ${locationId}`);
    return null;
  }

  const { data: apiKey, error: vaultError } = await supabase.rpc(
    "get_ghl_api_key_encrypted",
    { p_integration_id: integration.id }
  );

  if (vaultError || !apiKey) {
    console.error(`Failed to retrieve GHL API key: ${vaultError?.message}`);
    return null;
  }

  return { apiKey, locationId: integration.location_id };
}

// Fetch with retry and exponential backoff for rate limiting
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      // Rate limited - wait with exponential backoff
      const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.log(`Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    
    return response;
  }
  
  // Return a mock 429 response if all retries failed
  return new Response(JSON.stringify({ statusCode: 429, message: "Rate limit exceeded after retries" }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' }
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contact_id, location_id } = await req.json();

    if (!contact_id) {
      return new Response(JSON.stringify({ error: 'contact_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // If location_id not provided, look it up from the contact
    let effectiveLocationId = location_id;
    if (!effectiveLocationId) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('location_id')
        .eq('ghl_id', contact_id)
        .single();
      
      effectiveLocationId = contactData?.location_id || 'local';
    }

    const ghlCredentials = await getGHLCredentials(supabase, effectiveLocationId);
    
    // If no GHL credentials, return cached conversations from Supabase only
    if (!ghlCredentials) {
      console.log('No GHL credentials configured, returning cached conversations only (local-only mode)');
      
      const { data: cachedConversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('contact_id', contact_id)
        .order('last_message_date', { ascending: false });
      
      const formattedConversations = (cachedConversations || []).map((conv: any) => ({
        ghl_id: conv.ghl_id,
        contact_id: conv.contact_id,
        type: conv.type,
        unread_count: conv.unread_count || 0,
        inbox_status: conv.inbox_status,
        last_message_body: conv.last_message_body,
        last_message_date: conv.last_message_date,
        last_message_type: conv.last_message_type,
        last_message_direction: conv.last_message_direction,
        messages: [],
      }));
      
      return new Response(
        JSON.stringify({ 
          conversations: formattedConversations,
          localOnlyMode: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { apiKey: ghlApiKey, locationId } = ghlCredentials;

    console.log(`Fetching conversations for contact: ${contact_id} (location: ${locationId})`);

    // Fetch conversations filtered by contact ID with retry
    const params = new URLSearchParams({
      locationId,
      contactId: contact_id,
      limit: '20',
    });

    const response = await fetchWithRetry(`https://services.leadconnectorhq.com/conversations/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    // If rate limited, return cached conversations from Supabase
    if (response.status === 429) {
      console.log('GHL rate limited, returning cached conversations from Supabase');
      
      const { data: cachedConversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('contact_id', contact_id)
        .order('last_message_date', { ascending: false });
      
      const formattedConversations = (cachedConversations || []).map((conv: any) => ({
        ghl_id: conv.ghl_id,
        contact_id: conv.contact_id,
        type: conv.type,
        unread_count: conv.unread_count || 0,
        inbox_status: conv.inbox_status,
        last_message_body: conv.last_message_body,
        last_message_date: conv.last_message_date,
        last_message_type: conv.last_message_type,
        last_message_direction: conv.last_message_direction,
        messages: [], // No messages available from cache
      }));

      return new Response(JSON.stringify({ conversations: formattedConversations, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GHL Conversations API Error:', errorText);
      
      // Return cached data on error
      const { data: cachedConversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('contact_id', contact_id)
        .order('last_message_date', { ascending: false });
      
      const formattedConversations = (cachedConversations || []).map((conv: any) => ({
        ghl_id: conv.ghl_id,
        contact_id: conv.contact_id,
        type: conv.type,
        unread_count: conv.unread_count || 0,
        inbox_status: conv.inbox_status,
        last_message_body: conv.last_message_body,
        last_message_date: conv.last_message_date,
        last_message_type: conv.last_message_type,
        last_message_direction: conv.last_message_direction,
        messages: [],
      }));

      return new Response(JSON.stringify({ conversations: formattedConversations, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const conversations = data.conversations || [];
    
    console.log(`Found ${conversations.length} conversations for contact ${contact_id}`);

    // For each conversation, fetch the full message history (with rate limit handling)
    const conversationsWithMessages = await Promise.all(
      conversations.map(async (conv: any) => {
        try {
          // Fetch messages for this conversation with retry
          const messagesResponse = await fetchWithRetry(
            `https://services.leadconnectorhq.com/conversations/${conv.id}/messages?limit=50`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${ghlApiKey}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json',
              },
            }
          );

          let messages: Message[] = [];
          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            // Handle both array and object responses
            const rawMessages = Array.isArray(messagesData.messages) ? messagesData.messages : [];
            messages = rawMessages.map((msg: any) => ({
              id: msg.id,
              body: msg.body || msg.text || '',
              direction: msg.direction,
              status: msg.status,
              type: msg.type || msg.messageType,
              dateAdded: msg.dateAdded,
              attachments: msg.attachments,
            }));
            console.log(`Fetched ${messages.length} messages for conversation ${conv.id}`);
          } else if (messagesResponse.status === 429) {
            console.log(`Rate limited fetching messages for conversation ${conv.id}, skipping`);
          } else {
            console.error(`Failed to fetch messages for conversation ${conv.id}`);
          }

          return {
            ghl_id: conv.id,
            contact_id: conv.contactId,
            type: conv.type,
            unread_count: conv.unreadCount || 0,
            inbox_status: conv.inboxStatus,
            last_message_body: conv.lastMessageBody,
            last_message_date: conv.lastMessageDate,
            last_message_type: conv.lastMessageType,
            last_message_direction: conv.lastMessageDirection,
            messages: messages,
          };
        } catch (err) {
          console.error(`Error fetching messages for conversation ${conv.id}:`, err);
          return {
            ghl_id: conv.id,
            contact_id: conv.contactId,
            type: conv.type,
            unread_count: conv.unreadCount || 0,
            inbox_status: conv.inboxStatus,
            last_message_body: conv.lastMessageBody,
            last_message_date: conv.lastMessageDate,
            last_message_type: conv.lastMessageType,
            last_message_direction: conv.lastMessageDirection,
            messages: [],
          };
        }
      })
    );

    return new Response(JSON.stringify({ conversations: conversationsWithMessages }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching contact conversations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
