import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getAllMethodologies,
  getAllReasonCodesFlat,
  getReasonCodesForMethodology,
  getOutcomes,
  getItemTypeConfig,
  getRecommendedMethodology,
} from '@/lib/dispute-config-loader';

async function validateAdmin() {
  const session = await auth.api.getSession({
    headers: new Headers(),
  });
  
  if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
    return null;
  }
  
  return session.user;
}

// GET - Fetch all methodologies and related configuration
export async function GET(request: Request) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filterByMethodology = searchParams.get('methodology');
    const itemType = searchParams.get('itemType');
    const round = searchParams.get('round');

    // Get all methodologies
    const methodologies = getAllMethodologies();
    
    // Transform methodologies for frontend consumption
    const methodologyList = Object.entries(methodologies).map(([key, config]) => ({
      code: key,
      name: config.name,
      description: config.description,
      roundRange: config.round_range,
      targetRecipients: config.target_recipients,
      bestFor: config.best_for,
      successIndicators: config.success_indicators || [],
    }));

    // Get reason codes (filtered by methodology if specified)
    let reasonCodes;
    if (filterByMethodology) {
      reasonCodes = getReasonCodesForMethodology(filterByMethodology);
    } else {
      reasonCodes = getAllReasonCodesFlat();
    }

    // Transform reason codes for frontend
    const reasonCodeList = reasonCodes.map(code => ({
      code: code.code,
      label: code.label,
      description: code.description,
      methodologyFit: code.methodology_fit,
      fcraSections: code.fcra_section ? [code.fcra_section] : [],
      strength: code.dispute_strength,
      metro2Field: code.metro2_field,
    }));

    // Get outcomes
    const outcomes = getOutcomes();

    // Get recommended methodology if item type provided
    let recommendedMethodology = null;
    if (itemType) {
      const roundNum = round ? parseInt(round, 10) : 1;
      recommendedMethodology = getRecommendedMethodology(itemType, roundNum);
    }

    // Get item type config if provided
    let itemTypeConfig = null;
    if (itemType) {
      itemTypeConfig = getItemTypeConfig(itemType);
    }

    return NextResponse.json({
      methodologies: methodologyList,
      reason_codes: reasonCodeList,
      outcomes: outcomes,
      recommended_methodology: recommendedMethodology,
      item_type_config: itemTypeConfig,
    });
  } catch (error) {
    console.error('Error loading dispute methodologies:', error);
    return NextResponse.json(
      { error: 'Failed to load dispute methodologies' },
      { status: 500 }
    );
  }
}
