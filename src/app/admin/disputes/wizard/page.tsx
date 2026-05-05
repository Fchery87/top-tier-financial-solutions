'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DisputeWizardProgressBar } from '@/components/admin/DisputeWizardProgressBar';
import { WizardProvider, useWizardContext } from '@/components/admin/dispute-wizard/WizardContext';
import { WizardModals } from '@/components/admin/dispute-wizard/WizardModals';
import { StepClientSelect } from '@/components/admin/dispute-wizard/StepClientSelect';
import { StepItemSelect } from '@/components/admin/dispute-wizard/StepItemSelect';
import { StepConfigure } from '@/components/admin/dispute-wizard/StepConfigure';
import { StepReview } from '@/components/admin/dispute-wizard/StepReview';
import { WIZARD_STEPS } from '@/components/admin/dispute-wizard/types';

function DisputeWizardContent() {
  const router = useRouter();
  const {
    currentStep, setCurrentStep, maxSteps,
    generating, analyzingItems, analysisProgress, estimatedTimeRemaining,
    generationProgress, generationMethod,
    validateCurrentStep, canProceed,
    analyzeItemsWithAI, generateLetters,
    buildStepStatuses, handleStepClick,
  } = useWizardContext();

  const stepStatuses = buildStepStatuses();

  return (
    <div className="space-y-6">
      <WizardModals />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-serif font-bold text-foreground">
            Dispute Wizard
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-muted-foreground mt-1">
            Generate AI-powered dispute letters with FCRA, CRSA, and Metro 2 compliance
          </motion.p>
        </div>
        <Button variant="outline" onClick={() => router.push('/admin/clients')}>
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Clients
        </Button>
      </div>

      {/* Progress Steps */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="bg-card border border-border">
          <CardContent className="p-6">
            <DisputeWizardProgressBar
              steps={WIZARD_STEPS}
              currentStep={currentStep}
              stepStatuses={stepStatuses}
              onStepClick={handleStepClick}
              maxSteps={WIZARD_STEPS.length}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Step Content */}
      <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
        {currentStep === 1 && <StepClientSelect />}
        {currentStep === 2 && <StepItemSelect />}
        {currentStep === 3 && <StepConfigure />}
        {currentStep === 4 && <StepReview />}
      </motion.div>

      {/* Navigation Buttons */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))} disabled={currentStep === 1} title="Keyboard shortcut: Escape">
          <ArrowLeft className="w-4 h-4 mr-2" />Back<span className="hidden sm:inline ml-2 text-xs text-muted-foreground">(Esc)</span>
        </Button>

        {currentStep === 3 ? (
          <Button
            data-generate-button
            onClick={async () => {
              if (!validateCurrentStep()) return;
              let analysisData = null;
              if (generationMethod === 'ai') analysisData = await analyzeItemsWithAI();
              await generateLetters(analysisData);
            }}
            disabled={!canProceed() || generating || analyzingItems}
          >
            {analyzingItems ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing Items... ({Math.round(analysisProgress)}%)
                {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && <span className="ml-2 text-xs opacity-75">~{estimatedTimeRemaining}s</span>}
              </>
            ) : generating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating ({generationProgress}%)</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />{generationMethod === 'ai' ? 'Analyze & Generate' : 'Generate Letters'}</>
            )}
          </Button>
        ) : currentStep === 4 ? (
          <Button onClick={() => router.push('/admin/clients')}>
            <CheckCircle className="w-4 h-4 mr-2" />Done
          </Button>
        ) : (
          <Button
            onClick={() => { if (!validateCurrentStep()) return; setCurrentStep(prev => Math.min(maxSteps, prev + 1)); }}
            disabled={!canProceed()}
            title="Keyboard shortcut: Enter"
          >
            Next<ArrowRight className="w-4 h-4 ml-2" /><span className="hidden sm:inline ml-2 text-xs">(↵)</span>
          </Button>
        )}
      </motion.div>
    </div>
  );
}

export default function DisputeWizardPage() {
  return (
    <WizardProvider>
      <DisputeWizardContent />
    </WizardProvider>
  );
}
