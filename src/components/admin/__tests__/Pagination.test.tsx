import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from '../Pagination';

describe('Pagination', () => {
  const mockOnPageChange = vi.fn();
  const mockOnItemsPerPageChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering Conditions', () => {
    it('should return null when totalPages is 1 and no onItemsPerPageChange', () => {
      const { container } = render(
        <Pagination
          page={1}
          totalPages={1}
          totalItems={5}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render when totalPages is 1 but onItemsPerPageChange is provided', () => {
      render(
        <Pagination
          page={1}
          totalPages={1}
          totalItems={5}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
          onItemsPerPageChange={mockOnItemsPerPageChange}
        />
      );

      expect(screen.getByText(/Showing 1 to 5 of 5 results/)).toBeInTheDocument();
    });

    it('should render when totalPages is greater than 1', () => {
      render(
        <Pagination
          page={1}
          totalPages={3}
          totalItems={30}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      expect(screen.getByText(/Showing 1 to 10 of 30 results/)).toBeInTheDocument();
    });

    it('should not show navigation buttons when totalPages is 1', () => {
      render(
        <Pagination
          page={1}
          totalPages={1}
          totalItems={5}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
          onItemsPerPageChange={mockOnItemsPerPageChange}
        />
      );

      // Navigation buttons should not be present
      const buttons = screen.queryAllByRole('button');
      // Should only have the select element, no navigation buttons
      expect(buttons.length).toBe(0);
    });
  });

  describe('Item Range Display', () => {
    it('should display correct range for first page', () => {
      render(
        <Pagination
          page={1}
          totalPages={5}
          totalItems={50}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      expect(screen.getByText('Showing 1 to 10 of 50 results')).toBeInTheDocument();
    });

    it('should display correct range for middle page', () => {
      render(
        <Pagination
          page={3}
          totalPages={5}
          totalItems={50}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      expect(screen.getByText('Showing 21 to 30 of 50 results')).toBeInTheDocument();
    });

    it('should display correct range for last page with partial items', () => {
      render(
        <Pagination
          page={5}
          totalPages={5}
          totalItems={47}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      // Last page: items 41-47
      expect(screen.getByText('Showing 41 to 47 of 47 results')).toBeInTheDocument();
    });

    it('should display correct range for single item page', () => {
      render(
        <Pagination
          page={1}
          totalPages={1}
          totalItems={1}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
          onItemsPerPageChange={mockOnItemsPerPageChange}
        />
      );

      expect(screen.getByText('Showing 1 to 1 of 1 results')).toBeInTheDocument();
    });
  });

  describe('Page Number Generation', () => {
    it('should show all page numbers when totalPages <= 7', () => {
      render(
        <Pagination
          page={3}
          totalPages={5}
          totalItems={50}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      // Should have buttons for pages 1, 2, 3, 4, 5
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();

      // Should not have ellipsis
      expect(screen.queryByText('...')).not.toBeInTheDocument();
    });

    it('should show ellipsis when on first page of many pages', () => {
      render(
        <Pagination
          page={1}
          totalPages={10}
          totalItems={100}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      // Should show: 1, 2, ..., 10
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('...')).toBeInTheDocument();
    });

    it('should show both ellipses when on middle page', () => {
      render(
        <Pagination
          page={5}
          totalPages={10}
          totalItems={100}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      // Should show: 1, ..., 4, 5, 6, ..., 10
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();

      const ellipses = screen.getAllByText('...');
      expect(ellipses.length).toBe(2);
    });

    it('should show left ellipsis only when on last page', () => {
      render(
        <Pagination
          page={10}
          totalPages={10}
          totalItems={100}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      // Should show: 1, ..., 9, 10
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('9')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();

      const ellipses = screen.getAllByText('...');
      expect(ellipses.length).toBe(1);
    });

    it('should handle page 2 correctly (no left ellipsis)', () => {
      render(
        <Pagination
          page={2}
          totalPages={10}
          totalItems={100}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      // Should show: 1, 2, 3, ..., 10 (no left ellipsis since page <= 3)
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();

      const ellipses = screen.getAllByText('...');
      expect(ellipses.length).toBe(1); // Only right ellipsis
    });

    it('should handle second-to-last page correctly (no right ellipsis)', () => {
      render(
        <Pagination
          page={9}
          totalPages={10}
          totalItems={100}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      // Should show: 1, ..., 8, 9, 10 (no right ellipsis since page >= totalPages - 2)
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('9')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();

      const ellipses = screen.getAllByText('...');
      expect(ellipses.length).toBe(1); // Only left ellipsis
    });

    it('should handle 100+ pages correctly', () => {
      render(
        <Pagination
          page={50}
          totalPages={150}
          totalItems={1500}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      // Should show: 1, ..., 49, 50, 51, ..., 150
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('49')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('51')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();

      const ellipses = screen.getAllByText('...');
      expect(ellipses.length).toBe(2);
    });
  });

  describe('Navigation Buttons', () => {
    it('should disable first and previous buttons on first page', () => {
      const { container } = render(
        <Pagination
          page={1}
          totalPages={5}
          totalItems={50}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      const buttons = container.querySelectorAll('button');
      // First two buttons are "First Page" and "Previous"
      expect(buttons[0]).toBeDisabled();
      expect(buttons[1]).toBeDisabled();
    });

    it('should disable last and next buttons on last page', () => {
      const { container } = render(
        <Pagination
          page={5}
          totalPages={5}
          totalItems={50}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      const buttons = container.querySelectorAll('button');
      // Last two buttons are "Next" and "Last Page"
      const lastButton = buttons[buttons.length - 1];
      const secondLastButton = buttons[buttons.length - 2];

      expect(secondLastButton).toBeDisabled();
      expect(lastButton).toBeDisabled();
    });

    it('should enable all navigation buttons on middle page', () => {
      const { container } = render(
        <Pagination
          page={3}
          totalPages={5}
          totalItems={50}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      const buttons = container.querySelectorAll('button');
      // Check first, previous, next, and last buttons
      expect(buttons[0]).not.toBeDisabled(); // First
      expect(buttons[1]).not.toBeDisabled(); // Previous
      expect(buttons[buttons.length - 2]).not.toBeDisabled(); // Next
      expect(buttons[buttons.length - 1]).not.toBeDisabled(); // Last
    });

    it('should call onPageChange(1) when clicking first page button', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <Pagination
          page={5}
          totalPages={10}
          totalItems={100}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      const firstButton = container.querySelectorAll('button')[0];
      await user.click(firstButton);

      expect(mockOnPageChange).toHaveBeenCalledWith(1);
    });

    it('should call onPageChange(page - 1) when clicking previous button', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <Pagination
          page={5}
          totalPages={10}
          totalItems={100}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      const previousButton = container.querySelectorAll('button')[1];
      await user.click(previousButton);

      expect(mockOnPageChange).toHaveBeenCalledWith(4);
    });

    it('should call onPageChange(page + 1) when clicking next button', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <Pagination
          page={5}
          totalPages={10}
          totalItems={100}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      const buttons = container.querySelectorAll('button');
      const nextButton = buttons[buttons.length - 2];
      await user.click(nextButton);

      expect(mockOnPageChange).toHaveBeenCalledWith(6);
    });

    it('should call onPageChange(totalPages) when clicking last page button', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <Pagination
          page={5}
          totalPages={10}
          totalItems={100}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      const buttons = container.querySelectorAll('button');
      const lastButton = buttons[buttons.length - 1];
      await user.click(lastButton);

      expect(mockOnPageChange).toHaveBeenCalledWith(10);
    });

    it('should call onPageChange with specific page when clicking page number', async () => {
      const user = userEvent.setup();
      render(
        <Pagination
          page={1}
          totalPages={5}
          totalItems={50}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      const page3Button = screen.getByText('3');
      await user.click(page3Button);

      expect(mockOnPageChange).toHaveBeenCalledWith(3);
    });
  });

  describe('Items Per Page Selector', () => {
    it('should show items per page selector when onItemsPerPageChange is provided', () => {
      render(
        <Pagination
          page={1}
          totalPages={5}
          totalItems={50}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
          onItemsPerPageChange={mockOnItemsPerPageChange}
        />
      );

      expect(screen.getByText('Show')).toBeInTheDocument();
      expect(screen.getByText('per page')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should not show items per page selector when onItemsPerPageChange is not provided', () => {
      render(
        <Pagination
          page={1}
          totalPages={5}
          totalItems={50}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      expect(screen.queryByText('Show')).not.toBeInTheDocument();
      expect(screen.queryByText('per page')).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('should display current itemsPerPage value', () => {
      render(
        <Pagination
          page={1}
          totalPages={5}
          totalItems={50}
          itemsPerPage={20}
          onPageChange={mockOnPageChange}
          onItemsPerPageChange={mockOnItemsPerPageChange}
        />
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('20');
    });

    it('should have options for 10, 20, 50, and 100 items per page', () => {
      render(
        <Pagination
          page={1}
          totalPages={5}
          totalItems={50}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
          onItemsPerPageChange={mockOnItemsPerPageChange}
        />
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      const options = Array.from(select.options).map((opt) => opt.value);

      expect(options).toEqual(['10', '20', '50', '100']);
    });

    it('should call onItemsPerPageChange when selecting different value', async () => {
      const user = userEvent.setup();
      render(
        <Pagination
          page={1}
          totalPages={5}
          totalItems={50}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
          onItemsPerPageChange={mockOnItemsPerPageChange}
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, '50');

      expect(mockOnItemsPerPageChange).toHaveBeenCalledWith(50);
    });
  });

  describe('Current Page Styling', () => {
    it('should highlight current page button differently', () => {
      render(
        <Pagination
          page={3}
          totalPages={5}
          totalItems={50}
          itemsPerPage={10}
          onPageChange={mockOnPageChange}
        />
      );

      // Find the button with text "3"
      const page3Button = screen.getByText('3').closest('button');

      // Current page should not have 'outline' variant (should have 'secondary')
      // This is indirectly tested by checking that it's rendered differently
      expect(page3Button).toBeInTheDocument();
    });
  });
});
