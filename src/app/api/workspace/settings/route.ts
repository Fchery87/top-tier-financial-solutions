import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { deleteSetting, getSettingsByCategory, setSetting } from '@/lib/settings-service';
import { requireCapability } from '@/lib/admin-session';
import { recordAdminActivity } from '@/lib/admin-activity';
import { logServerEvent } from '@/lib/server-logger';
import { boundedJsonValue, readJsonBody, type BoundedJsonValue } from '@/lib/request-validation';
import { z } from 'zod';

type SettingValue = BoundedJsonValue;
const settingTypeSchema = z.enum(['string', 'number', 'boolean', 'json']);

const settingsWriteSchema = z.object({
  key: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/),
  value: boundedJsonValue(),
  type: settingTypeSchema,
  category: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  isSecret: z.boolean().optional(),
}).strict();

/**
 * GET /api/workspace/settings
 * Get all settings or settings by category
 */
export async function GET(request: NextRequest) {
  const adminUser = await requireCapability('settings:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');

    if (category) {
      const settings = await getSettingsByCategory(category);
      return NextResponse.json({ settings });
    }

    // Get all settings
    const allSettings = await db.select().from(systemSettings);

    // Parse values and hide secrets
    const parsedSettings = allSettings.map((setting) => {
      let parsedValue: SettingValue;
      
      // Hide secret values in response
      if (setting.isSecret) {
        parsedValue = setting.settingValue ? '***********' : null;
      } else {
        switch (setting.settingType) {
          case 'number':
            parsedValue = parseFloat(setting.settingValue || '0');
            break;
          case 'boolean':
            parsedValue = setting.settingValue === 'true';
            break;
          case 'json':
            try {
              parsedValue = JSON.parse(setting.settingValue || '{}');
            } catch {
              parsedValue = {};
            }
            break;
          default:
            parsedValue = setting.settingValue;
        }
      }

      return {
        ...setting,
        parsedValue,
      };
    });

    return NextResponse.json({ settings: parsedSettings });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.settings.error', error: error });
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

/**
 * PUT /api/workspace/settings
 * Update a setting value
 */
export async function PUT(request: NextRequest) {
  const adminUser = await requireCapability('settings:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const parsed = await readJsonBody(request, settingsWriteSchema);
    if (parsed.kind !== 'valid') {
      return NextResponse.json({ error: 'Missing required fields: key, type' }, { status: 400 });
    }
    const { key, value, type, category, description, isSecret } = parsed.data;

    await db.transaction(async (tx) => {
      await setSetting(key, value, type, category, description, isSecret, adminUser.id, tx);
      await recordAdminActivity(tx, {
        actorUserId: adminUser.id,
        action: 'settings.updated',
        subjectType: 'settings',
        subjectId: key,
        metadata: { changedFields: ['value', 'type', 'category', 'description', 'isSecret'] },
      });
    });

    return NextResponse.json({ 
      success: true, 
      message: `Setting "${key}" updated successfully` 
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.settings.error', error: error });
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}

/**
 * POST /api/workspace/settings
 * Create a new setting
 */
export async function POST(request: NextRequest) {
  const adminUser = await requireCapability('settings:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const parsed = await readJsonBody(request, settingsWriteSchema);
    if (parsed.kind !== 'valid') {
      return NextResponse.json({ error: 'Missing required fields: key, type' }, { status: 400 });
    }
    const { key, value, type, description } = parsed.data;
    const category = parsed.data.category ?? 'general';
    const isSecret = parsed.data.isSecret ?? false;

    const created = await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, key))
        .limit(1);
      if (existing.length > 0) return false;

      await setSetting(key, value, type, category, description, isSecret, adminUser.id, tx);
      await recordAdminActivity(tx, {
        actorUserId: adminUser.id,
        action: 'settings.created',
        subjectType: 'settings',
        subjectId: key,
        metadata: { changedFields: ['value', 'type', 'category', 'description', 'isSecret'] },
      });
      return true;
    });

    if (!created) {
      return NextResponse.json({ error: 'Setting already exists' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Setting "${key}" created successfully` 
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.settings.error', error: error });
    return NextResponse.json({ error: 'Failed to create setting' }, { status: 500 });
  }
}

/**
 * DELETE /api/workspace/settings
 * Delete a setting
 */
export async function DELETE(request: NextRequest) {
  const adminUser = await requireCapability('settings:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      await deleteSetting(key, tx);
      await recordAdminActivity(tx, {
        actorUserId: adminUser.id,
        action: 'settings.deleted',
        subjectType: 'settings',
        subjectId: key,
        metadata: { changedFields: [] },
      });
    });

    return NextResponse.json({ 
      success: true, 
      message: `Setting "${key}" deleted successfully` 
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.settings.error', error: error });
    return NextResponse.json({ error: 'Failed to delete setting' }, { status: 500 });
  }
}
