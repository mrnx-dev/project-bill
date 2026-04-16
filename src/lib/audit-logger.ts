import { prisma } from "@/lib/prisma";
import { dispatchEvent } from "./event-emitter";

export interface AuditLogParams {
  userId: string;
  action: string;
  title?: string;
  entityType?: string;
  entityId?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

/**
 * Creates an immutable audit log record for tracking important system events 
 * (financial transactions, SOW signatures, setting changes).
 */
export async function createAuditLog(params: AuditLogParams) {
  try {
    const log = await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        title: params.title ?? undefined,
        entityType: params.entityType ?? undefined,
        entityId: params.entityId ?? undefined,
        field: params.field ?? undefined,
        oldValue: params.oldValue ?? undefined,
        newValue: params.newValue ?? undefined,
      },
    });

    // Notify any active SSE listeners that a new activity occurred
    await dispatchEvent("system_events", {
      type: "activity_logged",
      data: log,
    });
  } catch (error) {
    // Failing to write an audit log should ideally not crash the parent transaction
    // but should be heavily alerted on in an APM tool if it fails
    console.error("[AuditLogger] Failed to write audit log:", error);
  }
}
