import { create } from 'zustand';
import { fetchJson } from '@/lib/clientApi';
import { Project } from '@/lib/types';

interface ProjectStore {
  projects: Project[];
  isLoading: boolean;

  loadProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  isLoading: false,

  loadProjects: async () => {
    set({ isLoading: true });
    try {
      const projects = await fetchJson<Project[]>('/api/projects');
      set({ projects, isLoading: false });
    } catch (error) {
      console.error('Failed to load projects:', error);
      set({ isLoading: false });
    }
  },

  createProject: async (name, description) => {
    const project = await fetchJson<Project>('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },

  deleteProject: async (id) => {
    await fetchJson<{ ok: boolean }>(`/api/projects/${id}`, {
      method: 'DELETE',
    });
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    }));
  },

  updateProject: async (id, updates) => {
    const updated = await fetchJson<Project>(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? updated : p)),
    }));
  },
}));
