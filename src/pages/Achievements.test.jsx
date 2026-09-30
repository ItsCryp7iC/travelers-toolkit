import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Achievements from './Achievements';
import useStore from '../store/useStore';

vi.mock('../store/useStore');
vi.mock('../data/achievements/categories.json', () => ({
  default: [
    { id: '0', name: 'Wonders of the World', order: 1 },
    { id: '1', name: 'Mortal Travails: Series I', order: 2 }
  ]
}));
vi.mock('../data/achievements/achievements.json', () => ({
  default: [
    { id: '80001', categoryId: '0', name: 'Test Achievement 1', description: 'Desc 1', primogems: 5, hidden: false, version: '1.0', order: 1 },
    { id: '80002', categoryId: '0', name: 'Test Achievement 2', description: 'Desc 2', primogems: 10, hidden: true, version: '1.1', order: 2 },
    { id: '80003', categoryId: '1', name: 'Test Achievement 3', description: 'Desc 3', primogems: 5, hidden: false, version: '1.2', order: 1 }
  ]
}));

describe('Achievements Page UI', () => {
  let mockSetAchievementCompleted;
  
  beforeEach(() => {
    mockSetAchievementCompleted = vi.fn();
    useStore.mockImplementation((selector) => {
      const state = {
        achievementProgress: {
          '80001': { completed: true, completedAt: '2024-01-01T00:00:00.000Z' }
        },
        setAchievementCompleted: mockSetAchievementCompleted
      };
      return selector(state);
    });
  });

  it('renders overall totals correctly', () => {
    render(<Achievements />);
    // 1 completed out of 3 total achievements
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('/ 3')).toBeInTheDocument();
    // 5 primogems earned out of 20 total
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('/ 20')).toBeInTheDocument();
  });

  it('renders category list and allows selection', () => {
    render(<Achievements />);
    expect(screen.getByText('Wonders of the World')).toBeInTheDocument();
    expect(screen.getByText('Mortal Travails: Series I')).toBeInTheDocument();
    
    // Select category 1
    fireEvent.click(screen.getByText('Mortal Travails: Series I'));
    
    // Should show achievement 3 but not 1
    expect(screen.getByText('Test Achievement 3')).toBeInTheDocument();
    expect(screen.queryByText('Test Achievement 1')).not.toBeInTheDocument();
  });

  it('renders category ID 0 by default', () => {
    render(<Achievements />);
    expect(screen.getByText('Test Achievement 1')).toBeInTheDocument();
  });

  it('toggles completion status', () => {
    render(<Achievements />);
    
    const checkboxes = screen.getAllByRole('checkbox');
    // The first one is ach 80001 which is completed
    expect(checkboxes[0]).toBeChecked();
    
    // The second one is ach 80002 which is incomplete
    expect(checkboxes[1]).not.toBeChecked();
    
    // Check 80002
    fireEvent.click(checkboxes[1]);
    expect(mockSetAchievementCompleted).toHaveBeenCalledWith('80002', true);
    
    // Uncheck 80001
    fireEvent.click(checkboxes[0]);
    expect(mockSetAchievementCompleted).toHaveBeenCalledWith('80001', false);
  });

  it('renders hidden indicators and version badges', () => {
    render(<Achievements />);
    expect(screen.getByText('Secret')).toBeInTheDocument(); // For 80002
    expect(screen.getByText('v1.0')).toBeInTheDocument();
    expect(screen.getByText('v1.1')).toBeInTheDocument();
  });

  it('filters by search and completion status', () => {
    render(<Achievements />);
    
    const searchInput = screen.getByPlaceholderText(/search/i);
    const filterSelect = screen.getByRole('combobox', { name: /filter/i });
    
    // Initial: 80001 and 80002 are shown
    expect(screen.getByText('Test Achievement 1')).toBeInTheDocument();
    expect(screen.getByText('Test Achievement 2')).toBeInTheDocument();
    
    // Search
    fireEvent.change(searchInput, { target: { value: 'Desc 2' } });
    expect(screen.queryByText('Test Achievement 1')).not.toBeInTheDocument();
    expect(screen.getByText('Test Achievement 2')).toBeInTheDocument();
    
    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    
    // Filter completed
    fireEvent.change(filterSelect, { target: { value: 'Completed' } });
    expect(screen.getByText('Test Achievement 1')).toBeInTheDocument();
    expect(screen.queryByText('Test Achievement 2')).not.toBeInTheDocument();
  });
});
