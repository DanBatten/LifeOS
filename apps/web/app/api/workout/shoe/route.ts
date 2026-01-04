export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';

/**
 * Update the shoe selection for a workout
 */
export async function PATCH(request: NextRequest) {
  const env = getEnv();
  const supabase = getSupabase();
  const userId = env.USER_ID;

  try {
    const { workoutId, shoeId } = await request.json();

    if (!workoutId) {
      return NextResponse.json({ error: 'workoutId is required' }, { status: 400 });
    }

    // Verify the workout belongs to the user
    const { data: workout, error: fetchError } = await supabase
      .from('workouts')
      .select('id, user_id')
      .eq('id', workoutId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !workout) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
    }

    // If shoeId provided, verify it exists and belongs to user
    if (shoeId) {
      const { data: shoe, error: shoeError } = await supabase
        .from('shoes')
        .select('id')
        .eq('id', shoeId)
        .eq('user_id', userId)
        .single();

      if (shoeError || !shoe) {
        return NextResponse.json({ error: 'Shoe not found' }, { status: 404 });
      }
    }

    // Update workout with shoe selection
    const { error: updateError } = await supabase
      .from('workouts')
      .update({
        shoe_id: shoeId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workoutId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[API:workout/shoe] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update workout' }, { status: 500 });
    }

    return NextResponse.json({ success: true, workoutId, shoeId });
  } catch (err) {
    console.error('[API:workout/shoe] Error:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

