import { getSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { WorkoutDetailView } from './WorkoutDetailView';

// Disable caching for this page - we want fresh data every time
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: { id: string };
}

export default async function WorkoutDetailPage({ params }: PageProps) {
  const supabase = getSupabase();

  const { data: workoutRaw, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !workoutRaw) {
    notFound();
  }

  // Cast to any for flexibility with untyped metadata
  const workout = workoutRaw as Record<string, unknown>;

  // Transform the data for the client component
  const metadata = (workout.metadata || {}) as Record<string, unknown>;
  const laps = (metadata.laps || []) as Array<{
    lapNumber: number;
    distanceMiles: number;
    durationSeconds: number;
    pacePerMile: string | null;
    avgHeartRate?: number;
    maxHeartRate?: number;
    avgCadence?: number;
    elevationGainFt?: number;
    elevationLossFt?: number;
    calories?: number;
  }>;

  const garminData = (metadata.garmin || {}) as Record<string, unknown>;

  const workoutData = {
    id: workout.id as string,
    title: workout.title as string,
    workoutType: workout.workout_type as string,
    status: workout.status as string,
    scheduledDate: workout.scheduled_date as string,
    completedAt: workout.completed_at as string | null,

    // Prescribed
    prescribedDescription: workout.prescribed_description as string | null,
    prescribedDistanceMiles: workout.prescribed_distance_miles as number | null,
    prescribedPacePerMile: workout.prescribed_pace_per_mile as string | null,
    prescribedHrZone: workout.prescribed_hr_zone as string | null,

    // Actual
    actualDurationMinutes: workout.actual_duration_minutes as number | null,
    actualDistanceMiles: metadata.actual_distance_miles as number | null,
    actualPacePerMile: metadata.actual_pace as string | null,
    avgHeartRate: workout.avg_heart_rate as number | null,
    maxHeartRate: workout.max_heart_rate as number | null,
    calories: workout.calories_burned as number | null,
    elevationGainFt: metadata.elevation_gain_ft as number | null,
    cadenceAvg: metadata.cadence_avg as number | null,

    // Laps
    laps,

    // Notes
    personalNotes: workout.personal_notes as string | null,
    coachNotes: workout.coach_notes as string | null,
    perceivedExertion: workout.perceived_exertion as number | null,

    // Garmin data
    garminActivityId: workout.external_id as string | null,
    aerobicTrainingEffect: garminData.aerobicTrainingEffect as number | null,
    anaerobicTrainingEffect: garminData.anaerobicTrainingEffect as number | null,
  };

  return (
    <main className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] pb-28">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#fafafa]/80 dark:bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/schedule"
              className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {workoutData.title}
              </h1>
              <p className="text-sm text-gray-500">
                {new Date(workoutData.scheduledDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <span
              className={`text-xs px-3 py-1 rounded-full font-medium ${
                workoutData.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : workoutData.status === 'skipped'
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {workoutData.status === 'completed' ? 'Done' : workoutData.status}
            </span>
          </div>
        </div>
      </header>

      <WorkoutDetailView workout={workoutData} />
    </main>
  );
}
