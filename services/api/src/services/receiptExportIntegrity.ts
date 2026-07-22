import type { ObjectMetadata, PrivateStorageAdapter } from '../compliance/storage.js';

interface ExportReceiptObject {
  id: string;
  storageKey: string;
  providerObjectVersion: string | null;
}

export class ReceiptExportIntegrityError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = code;
  }
}

export async function assertReceiptObjectsExportable(
  storage: PrivateStorageAdapter,
  receiptObjects: ExportReceiptObject[],
): Promise<void> {
  for (const receipt of receiptObjects) {
    if (!receipt.providerObjectVersion) {
      throw new ReceiptExportIntegrityError(
        'RECEIPT_OBJECT_VERSION_UNAVAILABLE',
        `Receipt ${receipt.id} is missing its immutable storage version.`,
      );
    }
    let metadata: ObjectMetadata;
    try {
      metadata = await storage.getObjectMetadata(
        'receipts',
        receipt.storageKey,
        receipt.providerObjectVersion,
      );
    } catch {
      throw new ReceiptExportIntegrityError(
        'RECEIPT_OBJECT_UNAVAILABLE',
        `Receipt ${receipt.id} is unavailable from private storage.`,
      );
    }
    if (metadata.versionId !== receipt.providerObjectVersion) {
      throw new ReceiptExportIntegrityError(
        'RECEIPT_OBJECT_VERSION_MISMATCH',
        `Receipt ${receipt.id} did not resolve to its immutable storage version.`,
      );
    }
  }
}
