import { create } from 'zustand'
import { uid } from '@/lib/utils'

export type ToastVariant = 'default' | 'success' | 'warning' | 'destructive'

export interface Toast {
  id: string
  title: string
  description?: string
  lines?: string[]
  variant: ToastVariant
  duration: number
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id' | 'variant' | 'duration'> & Partial<Pick<Toast, 'variant' | 'duration'>>) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = uid()
    const duration = toast.duration ?? 5000
    set((s) => ({
      toasts: [...s.toasts, { variant: 'default', ...toast, id, duration }]
    }))
    if (duration > 0) {
      setTimeout(() => get().dismiss(id), duration)
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))
