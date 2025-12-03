import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, creditAnalyses, user } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin, isAdmin } from '@/lib/admin-auth';
import { eq, desc, sql } from 'drizzle-orm';

interface PipelineClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  stage: string;
  assignedTo: string | null;
  assignedToName: string | null;
  latestScore: number | null;
  daysInStage: number;
  createdAt: string;
  updatedAt: string;
}

interface PipelineData {
  stages: {
    lead: PipelineClient[];
    consultation: PipelineClient[];
    agreement: PipelineClient[];
    onboarding: PipelineClient[];
    active: PipelineClient[];
    completed: PipelineClient[];
  };
  counts: {
    lead: number;
    consultation: number;
    agreement: number;
    onboarding: number;
    active: number;
    completed: number;
    total: number;
  };
}

async function validateAdminAccess() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.email) {
    return { authorized: false, user: null, role: null };
  }
  
  const isSuperAdminUser = await isSuperAdmin(session.user.email);
  const isAdminUser = await isAdmin(session.user.email);
  
  if (!isSuperAdminUser && !isAdminUser) {
    return { authorized: false, user: null, role: null };
  }
  
  return { 
    authorized: true, 
    user: session.user,
    role: isSuperAdminUser ? 'super_admin' : 'admin'
  };
}

export async function GET(request: NextRequest) {
  const { authorized, user: adminUser, role } = await validateAdminAccess();
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all clients with their latest score and assigned user name
    const clientsWithDetails = await db
      .select({
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
        stage: clients.stage,
        assignedTo: clients.assignedTo,
        assignedToName: user.name,
        createdAt: clients.createdAt,
        updatedAt: clients.updatedAt,
      })
      .from(clients)
      .leftJoin(user, eq(clients.assignedTo, user.id))
      .orderBy(desc(clients.updatedAt));

    // Get latest scores for each client
    const latestScores = await db
      .select({
        clientId: creditAnalyses.clientId,
        avgScore: sql<number>`COALESCE(
          (${creditAnalyses.scoreTransunion} + ${creditAnalyses.scoreExperian} + ${creditAnalyses.scoreEquifax}) / 
          NULLIF(
            CASE WHEN ${creditAnalyses.scoreTransunion} IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN ${creditAnalyses.scoreExperian} IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN ${creditAnalyses.scoreEquifax} IS NOT NULL THEN 1 ELSE 0 END,
            0
          ),
          NULL
        )`.as('avg_score'),
      })
      .from(creditAnalyses)
      .orderBy(desc(creditAnalyses.createdAt));

    // Create a map of client ID to latest score
    const scoreMap = new Map<string, number>();
    for (const score of latestScores) {
      if (!scoreMap.has(score.clientId) && score.avgScore) {
        scoreMap.set(score.clientId, Math.round(score.avgScore));
      }
    }

    // Initialize pipeline data
    const pipeline: PipelineData = {
      stages: {
        lead: [],
        consultation: [],
        agreement: [],
        onboarding: [],
        active: [],
        completed: [],
      },
      counts: {
        lead: 0,
        consultation: 0,
        agreement: 0,
        onboarding: 0,
        active: 0,
        completed: 0,
        total: 0,
      },
    };

    // Process clients into stages
    const now = new Date();
    for (const client of clientsWithDetails) {
      const stage = (client.stage || 'lead') as keyof typeof pipeline.stages;
      const updatedAt = client.updatedAt ? new Date(client.updatedAt) : new Date(client.createdAt || now);
      const daysInStage = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

      const pipelineClient: PipelineClient = {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        stage: stage,
        assignedTo: client.assignedTo,
        assignedToName: client.assignedToName,
        latestScore: scoreMap.get(client.id) || null,
        daysInStage,
        createdAt: client.createdAt?.toISOString() || '',
        updatedAt: client.updatedAt?.toISOString() || '',
      };

      if (pipeline.stages[stage]) {
        pipeline.stages[stage].push(pipelineClient);
        pipeline.counts[stage]++;
        pipeline.counts.total++;
      }
    }

    return NextResponse.json(pipeline);
  } catch (error) {
    console.error('Error fetching pipeline data:', error);
    return NextResponse.json({ error: 'Failed to fetch pipeline data' }, { status: 500 });
  }
}

// Update client stage (drag-drop)
export async function PATCH(request: NextRequest) {
  const { authorized } = await validateAdminAccess();
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { clientId, newStage } = await request.json();

    if (!clientId || !newStage) {
      return NextResponse.json({ error: 'clientId and newStage are required' }, { status: 400 });
    }

    const validStages = ['lead', 'consultation', 'agreement', 'onboarding', 'active', 'completed'];
    if (!validStages.includes(newStage)) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
    }

    await db
      .update(clients)
      .set({ 
        stage: newStage,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating client stage:', error);
    return NextResponse.json({ error: 'Failed to update client stage' }, { status: 500 });
  }
}
