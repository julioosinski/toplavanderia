import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 1000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

type Action =
  | { type: "ADD_TOAST"; toast: ToasterToast }
  | { type: "UPDATE_TOAST"; toast: Partial<ToasterToast> & Pick<ToasterToast, "id"> }
  | { type: "DISMISS_TOAST"; toastId?: ToasterToast["id"] }
  | { type: "REMOVE_TOAST"; toastId?: ToasterToast["id"] }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toastItem) => {
          addToRemoveQueue(toastItem.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type ToastInput = Omit<ToasterToast, "id">

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toastBase(props: ToastInput) {
  const id = genId()

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) {
          dispatch({ type: "DISMISS_TOAST", toastId: id })
        }
      },
    },
  })

  return {
    id,
    dismiss: () => {
      dispatch({ type: "DISMISS_TOAST", toastId: id })
    },
    update: (p: Partial<ToastInput>) =>
      dispatch({ type: "UPDATE_TOAST", toast: { id, ...p } }),
  }
}

export const toast = Object.assign(toastBase, {
  success: (message: string, opts?: { description?: React.ReactNode }) =>
    toastBase({ title: message, description: opts?.description }),

  error: (message: string, opts?: { description?: React.ReactNode }) =>
    toastBase({
      title: message,
      description: opts?.description,
      variant: "destructive",
    }),

  info: (message: string, opts?: { description?: React.ReactNode }) =>
    toastBase({ title: message, description: opts?.description }),

  warning: (message: string, opts?: { description?: React.ReactNode }) =>
    toastBase({ title: message, description: opts?.description }),

  dismiss: (toastId?: string) => {
    dispatch({ type: "DISMISS_TOAST", toastId })
  },
})

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => {
      dispatch({ type: "DISMISS_TOAST", toastId })
    },
  }
}

export { useToast }
