import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.status === 429) {
      const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.log(`Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    return response;
  }
  throw lastError || new Error('Max retries exceeded');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contact_id } = await req.json();

    if (!contact_id) {
      return new Response(JSON.stringify({ error: 'contact_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ghlApiKey = Deno.env.get('GHL_API_KEY');
    const locationId = Deno.env.get('GHL_LOCATION_ID');

    if (!ghlApiKey || !locationId) {
      return new Response(JSON.stringify({ error: 'GHL credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Fetching conversations for contact: ${contact_id}`);

    // Fetch conversations filtered by contact ID with retry logic
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GHL Conversations API Error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to fetch conversations from GHL', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const conversations = data.conversations || [];
    
    console.log(`Found ${conversations.length} conversations for contact ${contact_id}`);

    // For each conversation, fetch the full message history with staggered requests
    const conversationsWithMessages = [];
    for (const conv of conversations) {
      try {
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Fetch messages for this conversation with retry logic
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
          messages = (messagesData.messages || []).map((msg: any) => ({
            id: msg.id,
            body: msg.body || msg.text || '',
            direction: msg.direction,
            status: msg.status,
            type: msg.type || msg.messageType,
            dateAdded: msg.dateAdded,
            attachments: msg.attachments,
          }));
          console.log(`Fetched ${messages.length} messages for conversation ${conv.id}`);
        } else {
          console.error(`Failed to fetch messages for conversation ${conv.id}`);
        }

        conversationsWithMessages.push({
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
        });
      } catch (err) {
        console.error(`Error fetching messages for conversation ${conv.id}:`, err);
        conversationsWithMessages.push({
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
        });
      }
    }

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