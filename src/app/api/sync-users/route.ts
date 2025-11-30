import { syncNeonAuthUsers } from '@/db/sync';

export async function POST() {
  try {
    const result = await syncNeonAuthUsers();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
