"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createManualTransaction } from "@/features/portfolios/server/actions";
import {
  createTransactionSchema,
  MANUAL_TRANSACTION_TYPES,
  type CreateTransactionInput,
} from "@/features/portfolios/validation/transaction";

export function AddTransactionDialog({ portfolioId }: { portfolioId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      portfolioId,
      ticker: "",
      type: "BUY",
      quantity: "",
      price: "",
      fees: "",
      occurredAt: new Date().toISOString().slice(0, 10),
    },
  });

  async function onSubmit(data: CreateTransactionInput) {
    try {
      await createManualTransaction(data);
      toast.success(`Recorded ${data.type} of ${data.ticker}`);
      setOpen(false);
      reset({ ...data, ticker: "", quantity: "", price: "", fees: "" });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record this transaction.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <PlusIcon className="size-3.5" /> Add transaction
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add transaction</DialogTitle>
          <DialogDescription>
            Recomputes this holding&apos;s quantity and average cost from its full transaction history — same
            math CSV import uses.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker</Label>
              <Input id="ticker" placeholder="e.g. AAPL" {...register("ticker")} />
              {errors.ticker ? <p className="text-destructive text-sm">{errors.ticker.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={watch("type")}
                onValueChange={(value) => value && setValue("type", value as CreateTransactionInput["type"])}
              >
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_TRANSACTION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" placeholder="10" {...register("quantity")} />
              {errors.quantity ? <p className="text-destructive text-sm">{errors.quantity.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price ($)</Label>
              <Input id="price" placeholder="150.00" {...register("price")} />
              {errors.price ? <p className="text-destructive text-sm">{errors.price.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fees">Fees ($)</Label>
              <Input id="fees" placeholder="0" {...register("fees")} />
              {errors.fees ? <p className="text-destructive text-sm">{errors.fees.message}</p> : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="occurredAt">Date</Label>
            <Input id="occurredAt" type="date" {...register("occurredAt")} />
            {errors.occurredAt ? (
              <p className="text-destructive text-sm">{errors.occurredAt.message}</p>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
