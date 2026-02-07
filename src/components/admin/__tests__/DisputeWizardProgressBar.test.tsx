import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DisputeWizardProgressBar, WizardStep, StepStatus } from '../DisputeWizardProgressBar';
import { FileText, ClipboardList, Settings, CheckSquare } from 'lucide-react';

// Mock framer-motion to avoid animation-related test issues
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onClick, ...props }: React.ComponentProps<'div'>) => (
      <div className={className} onClick={onClick} {...props}>
        {children}
      </div>
    ),
    button: ({ children, className, onClick, disabled, ...props }: React.ComponentProps<'button'>) => (
      <button className={className} onClick={onClick} disabled={disabled} {...props}>
        {children}
      </button>
    ),
  },
}));

describe('DisputeWizardProgressBar', () => {
  const mockSteps: WizardStep[] = [
    { id: 1, name: 'Client', icon: FileText },
    { id: 2, name: 'Items', icon: ClipboardList },
    { id: 3, name: 'Configure', icon: Settings },
    { id: 4, name: 'Review', icon: CheckSquare },
  ];

  describe('Progress Percentage Calculation', () => {
    it('should calculate 0% when no steps are complete', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={1}
          stepStatuses={stepStatuses}
        />
      );

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should calculate 25% when 1 of 4 steps is complete', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={2}
          stepStatuses={stepStatuses}
        />
      );

      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    it('should calculate 50% when 2 of 4 steps are complete', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={3}
          stepStatuses={stepStatuses}
        />
      );

      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should calculate 100% when all 4 steps are complete', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 3, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: true },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={4}
          stepStatuses={stepStatuses}
        />
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should respect custom maxSteps parameter', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps.slice(0, 2)}
          currentStep={2}
          stepStatuses={stepStatuses}
          maxSteps={2}
        />
      );

      // 1 of 2 steps complete = 50%
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  describe('Step Status Display', () => {
    it('should display all step names', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={1}
          stepStatuses={stepStatuses}
        />
      );

      expect(screen.getByText('Client')).toBeInTheDocument();
      expect(screen.getByText('Items')).toBeInTheDocument();
      expect(screen.getByText('Configure')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
    });

    it('should show checkmark indicator for completed steps', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      const { container } = render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={2}
          stepStatuses={stepStatuses}
        />
      );

      // Should have checkmark indicator (✓) for completed step
      const checkmarks = Array.from(container.querySelectorAll('.text-green-600')).filter(
        (el) => el.textContent === '✓'
      );
      expect(checkmarks.length).toBe(1);
    });

    it('should show "Error" text for steps with errors', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: false, hasErrors: true, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={2}
          stepStatuses={stepStatuses}
        />
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('should show "Warning" text for steps with warnings (but no errors)', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: false, hasErrors: false, hasWarnings: true, isCurrentStep: false },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={2}
          stepStatuses={stepStatuses}
        />
      );

      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('should not show "Warning" text when step has both errors and warnings (errors take precedence)', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: false, hasErrors: true, hasWarnings: true, isCurrentStep: false },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={2}
          stepStatuses={stepStatuses}
        />
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.queryByText('Warning')).not.toBeInTheDocument();
    });
  });

  describe('Click Handlers', () => {
    it('should call onStepClick when clicking a completed step', async () => {
      const user = userEvent.setup();
      const onStepClick = vi.fn();

      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      const { container } = render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={2}
          stepStatuses={stepStatuses}
          onStepClick={onStepClick}
        />
      );

      // Click the first step (completed, not current)
      const stepButtons = container.querySelectorAll('button');
      await user.click(stepButtons[0]);

      expect(onStepClick).toHaveBeenCalledWith(1);
      expect(onStepClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onStepClick when clicking the current step', async () => {
      const user = userEvent.setup();
      const onStepClick = vi.fn();

      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      const { container } = render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={2}
          stepStatuses={stepStatuses}
          onStepClick={onStepClick}
        />
      );

      // Click the second step (current step)
      const stepButtons = container.querySelectorAll('button');
      await user.click(stepButtons[1]);

      expect(onStepClick).not.toHaveBeenCalled();
    });

    it('should not call onStepClick when clicking an incomplete step', async () => {
      const user = userEvent.setup();
      const onStepClick = vi.fn();

      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      const { container } = render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={2}
          stepStatuses={stepStatuses}
          onStepClick={onStepClick}
        />
      );

      // Click the third step (incomplete)
      const stepButtons = container.querySelectorAll('button');
      await user.click(stepButtons[2]);

      expect(onStepClick).not.toHaveBeenCalled();
    });

    it('should not call onStepClick when onStepClick prop is not provided', async () => {
      const user = userEvent.setup();

      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      const { container } = render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={2}
          stepStatuses={stepStatuses}
          // No onStepClick prop
        />
      );

      const stepButtons = container.querySelectorAll('button');

      // Should not throw error when clicking
      await user.click(stepButtons[0]);

      // Component should still render correctly
      expect(screen.getByText('Client')).toBeInTheDocument();
    });
  });

  describe('Status Summary', () => {
    it('should show completed steps count', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={3}
          stepStatuses={stepStatuses}
        />
      );

      expect(screen.getByText(/Completed:/)).toBeInTheDocument();
      expect(screen.getByText(/2 of 4 steps/)).toBeInTheDocument();
    });

    it('should show error count when steps have errors', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: false, hasErrors: true, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: false, hasErrors: true, hasWarnings: false, isCurrentStep: false },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={3}
          stepStatuses={stepStatuses}
        />
      );

      expect(screen.getByText(/2 step\(s\) with errors/)).toBeInTheDocument();
    });

    it('should show warning count when steps have warnings (excluding errors)', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: false, hasErrors: false, hasWarnings: true, isCurrentStep: false },
        { stepId: 2, isComplete: false, hasErrors: true, hasWarnings: true, isCurrentStep: false },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: true, isCurrentStep: true },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={3}
          stepStatuses={stepStatuses}
        />
      );

      // Should show 2 warnings (steps 1 and 3, excluding step 2 which has errors)
      expect(screen.getByText(/2 step\(s\) with warnings/)).toBeInTheDocument();
    });

    it('should not show error count when no errors', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={2}
          stepStatuses={stepStatuses}
        />
      );

      expect(screen.queryByText(/step\(s\) with errors/)).not.toBeInTheDocument();
    });
  });

  describe('Helpful Hint', () => {
    it('should show hint when completed steps exist and onStepClick is provided', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={2}
          stepStatuses={stepStatuses}
          onStepClick={vi.fn()}
        />
      );

      expect(screen.getByText('Click completed steps to edit')).toBeInTheDocument();
    });

    it('should not show hint when no completed steps exist', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={1}
          stepStatuses={stepStatuses}
          onStepClick={vi.fn()}
        />
      );

      expect(screen.queryByText('Click completed steps to edit')).not.toBeInTheDocument();
    });

    it('should not show hint when onStepClick is not provided', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={2}
          stepStatuses={stepStatuses}
          // No onStepClick prop
        />
      );

      expect(screen.queryByText('Click completed steps to edit')).not.toBeInTheDocument();
    });

    it('should not show hint when only current step is complete', () => {
      const stepStatuses: StepStatus[] = [
        { stepId: 1, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 2, isComplete: true, hasErrors: false, hasWarnings: false, isCurrentStep: true },
        { stepId: 3, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
        { stepId: 4, isComplete: false, hasErrors: false, hasWarnings: false, isCurrentStep: false },
      ];

      render(
        <DisputeWizardProgressBar
          steps={mockSteps}
          currentStep={2}
          stepStatuses={stepStatuses}
          onStepClick={vi.fn()}
        />
      );

      expect(screen.queryByText('Click completed steps to edit')).not.toBeInTheDocument();
    });
  });
});
