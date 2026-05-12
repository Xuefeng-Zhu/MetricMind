import { create } from 'zustand';
import { Dashboard } from '@/lib/dashboards/dashboard-service';

export interface DashboardState {
  dashboards: Dashboard[];
  currentDashboard: Dashboard | null;
  isLoading: boolean;
  setDashboards: (dashboards: Dashboard[]) => void;
  setCurrentDashboard: (dashboard: Dashboard | null) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  dashboards: [],
  currentDashboard: null,
  isLoading: false,

  setDashboards: (dashboards) => set({ dashboards }),

  setCurrentDashboard: (dashboard) => set({ currentDashboard: dashboard }),

  setIsLoading: (loading) => set({ isLoading: loading }),
}));
