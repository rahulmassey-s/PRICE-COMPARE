'use client';

import type { LabTest, LabPrice } from '@/types';
import React, { createContext, useContext, useReducer, ReactNode, useMemo } from 'react';

export interface CartItem {
  testDocId: string; // Firestore document ID of the test from 'tests' collection
  testName: string;
  testImageUrl?: string;
  labName: string;
  price: number;
  originalPrice?: number;
  quantity: number; 
  appointmentDateTime?: string;
}

interface CartState {
  items: CartItem[];
}

interface CartActions {
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (testDocId: string, labName: string) => void;
  clearCart: () => void;
  incrementQuantity: (testDocId: string, labName: string) => void; 
  decrementQuantity: (testDocId: string, labName: string) => void; 
  updateAppointmentDateTime: (testDocId: string, labName: string, appointmentDateTime: string) => void;
}

const CartStateContext = createContext<CartState | undefined>(undefined);
const CartActionsContext = createContext<CartActions | undefined>(undefined);

type Action =
  | { type: 'ADD_ITEM'; item: Omit<CartItem, 'quantity'> }
  | { type: 'REMOVE_ITEM'; testDocId: string; labName: string }
  | { type: 'CLEAR_CART' }
  | { type: 'INCREMENT_QUANTITY'; testDocId: string; labName: string }
  | { type: 'DECREMENT_QUANTITY'; testDocId: string; labName: string }
  | { type: 'UPDATE_APPOINTMENT_DATETIME'; testDocId: string; labName: string; appointmentDateTime: string };

const cartReducer = (state: CartState, action: Action): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingItemIndex = state.items.findIndex(
        (i) => i.testDocId === action.item.testDocId && i.labName === action.item.labName
      );
      if (existingItemIndex > -1) {
        // If item already exists, do not add again (quantity is always 1 for lab tests)
        return state; 
      }
      return { ...state, items: [...state.items, { ...action.item, quantity: 1 }] };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(
          (item) => !(item.testDocId === action.testDocId && item.labName === action.labName)
        ),
      };
    case 'CLEAR_CART':
      return { ...state, items: [] };
    case 'INCREMENT_QUANTITY': {
      // Typically not used for lab tests where quantity is 1, but kept for potential future use
      const updatedItems = state.items.map((item) =>
        item.testDocId === action.testDocId && item.labName === action.labName
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
      return { ...state, items: updatedItems };
    }
    case 'DECREMENT_QUANTITY': {
      // Typically not used for lab tests, will remove item if quantity becomes 0
      const updatedItems = state.items
        .map((item) =>
          item.testDocId === action.testDocId && item.labName === action.labName
            ? { ...item, quantity: Math.max(0, item.quantity - 1) } 
            : item
        )
        .filter((item) => item.quantity > 0); 
      return { ...state, items: updatedItems };
    }
    case 'UPDATE_APPOINTMENT_DATETIME': {
      const updatedItems = state.items.map((item) =>
        item.testDocId === action.testDocId && item.labName === action.labName
          ? { ...item, appointmentDateTime: action.appointmentDateTime }
          : item
      );
      return { ...state, items: updatedItems };
    }
    default:
      return state;
  }
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  const actions = useMemo(() => ({
    addToCart: (item: Omit<CartItem, 'quantity'>) => dispatch({ type: 'ADD_ITEM', item }),
    removeFromCart: (testDocId: string, labName: string) => dispatch({ type: 'REMOVE_ITEM', testDocId, labName }),
    clearCart: () => dispatch({ type: 'CLEAR_CART' }),
    incrementQuantity: (testDocId: string, labName: string) => dispatch({ type: 'INCREMENT_QUANTITY', testDocId, labName }),
    decrementQuantity: (testDocId: string, labName: string) => dispatch({ type: 'DECREMENT_QUANTITY', testDocId, labName }),
    updateAppointmentDateTime: (testDocId: string, labName: string, appointmentDateTime: string) =>
      dispatch({ type: 'UPDATE_APPOINTMENT_DATETIME', testDocId, labName, appointmentDateTime }),
  }), []);

  return (
    <CartStateContext.Provider value={state}>
      <CartActionsContext.Provider value={actions}>
        {children}
      </CartActionsContext.Provider>
    </CartStateContext.Provider>
  );
};

export const useCartState = () => {
  const context = useContext(CartStateContext);
  if (context === undefined) {
    throw new Error('useCartState must be used within a CartProvider');
  }
  return context;
};

export const useCartActions = () => {
  const context = useContext(CartActionsContext);
  if (context === undefined) {
    throw new Error('useCartActions must be used within a CartProvider');
  }
  return context;
};

export const useCart = () => {
  return { ...useCartState(), ...useCartActions() };
};

