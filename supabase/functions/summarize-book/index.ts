import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, language = 'ko' } = await req.json();

    if (!description || description.trim().length === 0) {
      return new Response(
        JSON.stringify({ summary: '' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If description is already short, return as-is
    if (description.length <= 200) {
      return new Response(
        JSON.stringify({ summary: description }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = language === 'ko' 
      ? `다음 책 설명을 4줄 이내로 간결하게 요약해주세요. 핵심 줄거리나 주제를 담아주세요. 존댓말을 사용하세요:\n\n${description}`
      : `Summarize the following book description in 4 lines or less, capturing the core plot or theme:\n\n${description}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: language === 'ko' 
              ? '당신은 책 설명을 간결하게 요약하는 도우미입니다. 4줄 이내로 핵심 내용만 전달하세요.'
              : 'You are a helpful assistant that summarizes book descriptions concisely in 4 lines or less.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || description.slice(0, 200) + '...';

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Summarization error:', error);
    
    // Fallback: simple truncation
    return new Response(
      JSON.stringify({ 
        summary: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
