import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const YT = 'https://www.googleapis.com/youtube/v3';

export interface ChannelSuggestion {
  type: 'banner' | 'pfp';
  title: string;
  prompt: string;
  reasoning: string;
}

export interface AnalyzeChannelResponse {
  channelName: string;
  channelType: string;
  thumbnailUrl: string | null;
  subscriberCount: string;
  videoCount: string;
  suggestions: ChannelSuggestion[];
}

function parseChannelInput(raw: string): { param: string; value: string } {
  const s = raw.trim();

  // youtube.com/channel/UCxxxxxx
  const byId = s.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (byId) return { param: 'id', value: byId[1] };

  // @handle anywhere in the string (URL or plain)
  const byHandle = s.match(/@([\w.-]+)/);
  if (byHandle) return { param: 'forHandle', value: byHandle[1] };

  // Bare UC... channel ID
  if (/^UC[\w-]{20,}$/.test(s)) return { param: 'id', value: s };

  // Treat as plain handle
  return { param: 'forHandle', value: s };
}

export async function POST(req: NextRequest) {
  try {
    const { channelInput } = await req.json() as { channelInput: string };

    if (!channelInput?.trim()) {
      return NextResponse.json({ error: 'Channel URL or handle is required' }, { status: 400 });
    }

    const ytKey = process.env.YOUTUBE_API_KEY;
    if (!ytKey || ytKey === 'your_youtube_api_key_here') {
      return NextResponse.json({ error: 'YouTube API key not configured in .env.local' }, { status: 500 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey || groqKey === 'your_groq_api_key_here') {
      return NextResponse.json({ error: 'Groq API key not configured in .env.local' }, { status: 500 });
    }

    // ── 1. Fetch channel from YouTube ─────────────────────────────────────
    const { param, value } = parseChannelInput(channelInput);
    const channelRes = await fetch(
      `${YT}/channels?part=snippet,statistics&${param}=${encodeURIComponent(value)}&key=${ytKey}`
    );

    if (!channelRes.ok) {
      const err = await channelRes.json().catch(() => ({}));
      throw new Error((err as { error?: { message?: string } }).error?.message ?? 'YouTube API error');
    }

    const channelData = await channelRes.json() as {
      items?: Array<{
        id: string;
        snippet: { title: string; description: string; country?: string; thumbnails?: Record<string, { url: string }> };
        statistics: { subscriberCount?: string; videoCount?: string };
      }>;
    };

    if (!channelData.items?.length) {
      return NextResponse.json(
        { error: 'Channel not found. Try pasting the full YouTube channel URL or using the @handle format.' },
        { status: 404 }
      );
    }

    const ch       = channelData.items[0];
    const snippet  = ch.snippet;
    const stats    = ch.statistics;
    const thumbUrl = snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? null;

    // ── 2. Fetch top videos for context ───────────────────────────────────
    const videosRes = await fetch(
      `${YT}/search?part=snippet&channelId=${ch.id}&maxResults=8&order=viewCount&type=video&key=${ytKey}`
    );
    const videosData = await videosRes.json() as {
      items?: Array<{ snippet?: { title?: string } }>;
    };
    const videoTitles = (videosData.items ?? [])
      .map(v => v.snippet?.title)
      .filter(Boolean)
      .join(' | ');

    // ── 3. Analyse with Groq ──────────────────────────────────────────────
    const groq = new Groq({ apiKey: groqKey });

    const systemPrompt = `You are a professional YouTube branding designer.
Given channel information, you produce creative, specific image-generation prompts for banners and profile pictures.
Always respond with valid JSON only — no markdown, no commentary.`;

    const userPrompt = `Analyze this YouTube channel and return exactly 5 branding suggestions (at least 2 banners and 2 pfps).

Channel Name: ${snippet.title}
Description: ${(snippet.description ?? '').slice(0, 600)}
Subscribers: ${Number(stats.subscriberCount ?? 0).toLocaleString()}
Top Video Titles: ${videoTitles || 'N/A'}
Country: ${snippet.country ?? 'N/A'}

Return JSON in this exact shape:
{
  "channelType": "one-line description of what this channel is about",
  "suggestions": [
    {
      "type": "banner",
      "title": "Short punchy style name",
      "prompt": "Detailed AI image generation prompt — 2-3 sentences, describe colors, mood, composition, visual style. Do NOT mention text or channel name.",
      "reasoning": "One sentence: why this fits the channel"
    }
  ]
}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const raw = completion.choices[0].message.content ?? '{}';
    const analysis = JSON.parse(raw) as { channelType: string; suggestions: ChannelSuggestion[] };

    const response: AnalyzeChannelResponse = {
      channelName:     snippet.title,
      channelType:     analysis.channelType ?? '',
      thumbnailUrl:    thumbUrl,
      subscriberCount: stats.subscriberCount ?? '0',
      videoCount:      stats.videoCount ?? '0',
      suggestions:     analysis.suggestions ?? [],
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('analyze-channel error:', error?.message);
    return NextResponse.json({ error: error?.message ?? 'Analysis failed' }, { status: 500 });
  }
}
