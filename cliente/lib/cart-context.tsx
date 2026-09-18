import React, { createContext, useContext, useState, useMemo } from "react";
import { Product } from "@/lib/api";

interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

interface CartContextValue {
  restaurantId: string | null;
  items: CartItem[];
  addItem: (restaurantId: string, product: Product) => void;
  removeItem: (productId: string) => void;
  decreaseItem: (productId: string) => void;
  clear: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

  function addItem(newRestaurantId: string, product: Product) {
    setItems((prev) => {
      // Si el carrito tiene productos de OTRO restaurante, se reemplaza
      // (no se pueden mezclar pedidos de dos comercios distintos).
      if (restaurantId && restaurantId !== newRestaurantId) {
        setRestaurantId(newRestaurantId);
        return [{ product, quantity: 1 }];
      }
      if (!restaurantId) setRestaurantId(newRestaurantId);

      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function decreaseItem(productId: string) {
    setItems((prev) => {
      const next = prev
        .map((i) => (i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);
      if (next.length === 0) setRestaurantId(null);
      return next;
    });
  }

  function removeItem(productId: string) {
    setItems((prev) => {
      const next = prev.filter((i) => i.product.id !== productId);
      if (next.length === 0) setRestaurantId(null);
      return next;
    });
  }

  function clear() {
    setItems([]);
    setRestaurantId(null);
  }

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    [items]
  );
  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{ restaurantId, items, addItem, removeItem, decreaseItem, clear, total, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
