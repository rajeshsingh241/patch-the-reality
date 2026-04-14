import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { awardCorrectVote, deductWrongVote } from '@/lib/tokenService';
import type { ApiResponse, VoteChoice } from '@/lib/database.types';

interface ResolveResult {
  poll_id: string;
  correct_answer: VoteChoice;
  total_votes: number;
  correct_votes_count: number;
  wrong_votes_count: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { poll_id, correct_answer } = body as {
      poll_id: string;
      correct_answer: VoteChoice;
    };

    if (!poll_id || !correct_answer) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'poll_id and correct_answer are required' },
        { status: 400 },
      );
    }
    if (correct_answer !== 'yes' && correct_answer !== 'no') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'correct_answer must be "yes" or "no"' },
        { status: 400 },
      );
    }

    // Check poll exists and is active
    const { data: poll, error: pollError } = await supabaseAdmin
      .from('polls')
      .select('id, status, correct_answer')
      .eq('id', poll_id)
      .single();

    if (pollError || !poll) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Poll not found' },
        { status: 404 },
      );
    }

    if (poll.status === 'closed') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Poll is already resolved' },
        { status: 409 },
      );
    }

    // Fetch all votes for this poll
    const { data: votes, error: votesError } = await supabaseAdmin
      .from('votes')
      .select('id, user_id, vote')
      .eq('poll_id', poll_id);

    if (votesError) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch votes' },
        { status: 500 },
      );
    }

    // Process each vote — award or penalize
    let correctCount = 0;
    let wrongCount = 0;

    const tokenOps = (votes ?? []).map(async (v) => {
      const isCorrect = v.vote === correct_answer;
      const tokensAwarded = isCorrect ? 10 : -3;

      if (isCorrect) {
        correctCount++;
        await awardCorrectVote(v.user_id, poll_id);
      } else {
        wrongCount++;
        await deductWrongVote(v.user_id, poll_id);
      }

      // Mark vote as resolved
      await supabaseAdmin
        .from('votes')
        .update({ is_correct: isCorrect, tokens_awarded: tokensAwarded })
        .eq('id', v.id);
    });

    await Promise.allSettled(tokenOps);

    // Close the poll
    const { error: closeError } = await supabaseAdmin
      .from('polls')
      .update({ status: 'closed', correct_answer })
      .eq('id', poll_id);

    if (closeError) {
      console.error('[polls/resolve] Failed to close poll:', closeError.message);
    }

    const result: ResolveResult = {
      poll_id,
      correct_answer,
      total_votes: (votes ?? []).length,
      correct_votes_count: correctCount,
      wrong_votes_count: wrongCount,
    };

    return NextResponse.json<ApiResponse<ResolveResult>>({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[polls/resolve] Unhandled error:', err);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
