"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { StatusChip, errorText, formatRange, timeAgo } from "./ui";

export type Loan = FunctionReturnType<typeof api.loans.myRequests>[number];

const ACTIVITY_LABEL: Record<string, string> = {
  notification: "Notification",
  overdue_reminder: "Reminder",
  error: "Automation error",
};

/** One loan with the actions allowed for the viewer's side of it, plus recent automation activity. */
export function LoanCard({ loan, side }: { loan: Loan; side: "lender" | "borrower" | "admin" }) {
  const approve = useMutation(api.loans.approve);
  const decline = useMutation(api.loans.decline);
  const cancel = useMutation(api.loans.cancel);
  const markReturned = useMutation(api.loans.markReturned);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = (fn: (a: { loanId: typeof loan._id }) => Promise<unknown>) => async () => {
    setBusy(true);
    setError("");
    try {
      await fn({ loanId: loan._id });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const other = side === "lender" ? `Borrower: ${loan.borrowerName}` : side === "borrower" ? `Lender: ${loan.lenderName}` : `${loan.lenderName} → ${loan.borrowerName}`;
  return (
    <li className="card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{loan.toolName}</p>
          <p className="text-sm text-stone-500">
            {formatRange(loan.startDate, loan.endDate)} · {other}
          </p>
        </div>
        <StatusChip status={loan.overdue ? "overdue" : loan.status} />
      </div>
      {loan.activity.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-stone-500">
          {loan.activity.map((a, i) => (
            <li key={i} className={a.status === "failed" ? "text-red-700" : ""}>
              {ACTIVITY_LABEL[a.kind] ?? a.kind} {a.status} {timeAgo(a.at)}: {a.message}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {side === "lender" && loan.status === "requested" && (
          <>
            <button className="btn-primary" disabled={busy} onClick={run(approve)}>
              Approve
            </button>
            <button className="btn-ghost" disabled={busy} onClick={run(decline)}>
              Decline
            </button>
          </>
        )}
        {side === "lender" && loan.status === "approved" && (
          <button className="btn-primary" disabled={busy} onClick={run(markReturned)}>
            Mark returned
          </button>
        )}
        {side === "borrower" && loan.status === "requested" && (
          <button className="btn-ghost" disabled={busy} onClick={run(cancel)}>
            Cancel request
          </button>
        )}
      </div>
    </li>
  );
}
