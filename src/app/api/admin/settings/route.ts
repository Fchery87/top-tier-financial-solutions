import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { deleteSetting, getSettingsByCategory, setSetting } from '@/lib/settings-service';
import { requireCapability } from '@/lib/admin-session';
import { recordAdminActivity } from '@/lib/admin-activity';

type SettingValue = string | number | boolean | Record<string, unknown> | unknown[] | null;
type SettingType = 'string' | 'number' | 'boolean' | 'json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSettingType(value: unknown): value is SettingType {
  return value === 'string' || value === 'number' || value === 'boolean' || value === 'json';
}

function isSettingValue(value: unknown): value is SettingValue {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    || Array.isArray(value) || isRecord(value);
}

/**
 * GET /api/admin/settings
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
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/settings
 * Update a setting value
 */
export async function PUT(request: NextRequest) {
  const adminUser = await requireCapability('settings:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rawBody: unknown = await request.json();
    if (!isRecord(rawBody)) return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    const key = typeof rawBody.key === 'string' ? rawBody.key : '';
    const value = rawBody.value;
    const type = rawBody.type;
    const category = typeof rawBody.category === 'string' ? rawBody.category : undefined;
    const description = typeof rawBody.description === 'string' ? rawBody.description : undefined;
    const isSecret = typeof rawBody.isSecret === 'boolean' ? rawBody.isSecret : undefined;

    if (!key || !isSettingType(type) || !isSettingValue(value)) {
      return NextResponse.json({ error: 'Missing required fields: key, type' }, { status: 400 });
    }

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
    console.error('Error updating setting:', error);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}

/**
 * POST /api/admin/settings
 * Create a new setting
 */
export async function POST(request: NextRequest) {
  const adminUser = await requireCapability('settings:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rawBody: unknown = await request.json();
    if (!isRecord(rawBody)) return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    const key = typeof rawBody.key === 'string' ? rawBody.key : '';
    const value = rawBody.value;
    const type = rawBody.type;
    const category = typeof rawBody.category === 'string' ? rawBody.category : 'general';
    const description = typeof rawBody.description === 'string' ? rawBody.description : undefined;
    const isSecret = rawBody.isSecret === true;

    if (!key || !isSettingType(type) || !isSettingValue(value)) {
      return NextResponse.json({ error: 'Missing required fields: key, type' }, { status: 400 });
    }

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
    console.error('Error creating setting:', error);
    return NextResponse.json({ error: 'Failed to create setting' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/settings
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
    console.error('Error deleting setting:', error);
    return NextResponse.json({ error: 'Failed to delete setting' }, { status: 500 });
  }
}
