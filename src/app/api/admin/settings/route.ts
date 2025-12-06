import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { setSetting, getSettingsByCategory, clearSettingsCache } from '@/lib/settings-service';

type SettingValue = string | number | boolean | Record<string, unknown> | unknown[] | null;

// Check if user is super admin
async function checkSuperAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return { authorized: false, error: 'Unauthorized' };
  }

  const userRole = (session.user as { role?: string }).role;
  if (userRole !== 'super_admin') {
    return { authorized: false, error: 'Super admin access required' };
  }

  return { authorized: true, userId: session.user.id };
}

/**
 * GET /api/admin/settings
 * Get all settings or settings by category
 */
export async function GET(request: NextRequest) {
  const authCheck = await checkSuperAdmin();
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: 403 });
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
  const authCheck = await checkSuperAdmin();
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: 403 });
  }

  try {
    const body: {
      key?: string;
      value?: unknown;
      type?: 'string' | 'number' | 'boolean' | 'json';
      category?: string;
      description?: string;
      isSecret?: boolean;
    } = await request.json();
    const { key, value, type, category, description, isSecret } = body;

    if (!key || type === undefined) {
      return NextResponse.json({ error: 'Missing required fields: key, type' }, { status: 400 });
    }

    await setSetting(key, value as SettingValue, type, category, description, isSecret, authCheck.userId);

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
  const authCheck = await checkSuperAdmin();
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { key, value, type, category, description, isSecret } = body;

    if (!key || type === undefined) {
      return NextResponse.json({ error: 'Missing required fields: key, type' }, { status: 400 });
    }

    // Check if setting already exists
    const existing = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, key))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Setting already exists' }, { status: 400 });
    }

    await setSetting(key, value, type, category || 'general', description, isSecret || false, authCheck.userId);

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
  const authCheck = await checkSuperAdmin();
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    await db.delete(systemSettings).where(eq(systemSettings.settingKey, key));
    clearSettingsCache();

    return NextResponse.json({ 
      success: true, 
      message: `Setting "${key}" deleted successfully` 
    });
  } catch (error) {
    console.error('Error deleting setting:', error);
    return NextResponse.json({ error: 'Failed to delete setting' }, { status: 500 });
  }
}
