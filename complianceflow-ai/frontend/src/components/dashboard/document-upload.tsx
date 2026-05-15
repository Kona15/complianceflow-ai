"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, X, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { uploadDocument } from "@/lib/api";
import { useToast } from "@/components/ui/toaster";

interface DocumentUploadProps {
  onUploadComplete: (jobId: string) => void;
}

export function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState("unknown");
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    try {
      for (const file of files) {
        const result = await uploadDocument(file, documentType);
        toast({
          title: "Upload Successful",
          description: `Job ${result.job_id.slice(0, 8)} initiated`,
          variant: "success",
        });
        onUploadComplete(result.job_id);
      }
      setFiles([]);
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? "border-violet-500 bg-violet-950/20"
            : "border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/50"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-10 h-10 mx-auto mb-3 text-slate-500" />
        <p className="text-sm font-medium text-slate-300">
          {isDragActive ? "Drop files here..." : "Drag & drop documents, or click to browse"}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Supports PDF, PNG, JPG (max 50MB)
        </p>
      </div>

      {/* Document Type Selector */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-400 font-medium">Document Type:</label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
        >
          <option value="unknown">Auto-detect</option>
          <option value="invoice">Invoice</option>
          <option value="contract">Contract</option>
          <option value="purchase_order">Purchase Order</option>
          <option value="compliance_certificate">Compliance Certificate</option>
        </select>
      </div>

      {/* File List */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {files.map((file, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-violet-400" />
                  <div>
                    <p className="text-sm text-slate-300 font-medium">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleUpload}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white font-medium text-sm hover:from-violet-500 hover:to-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing with Agent Swarm...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Start Compliance Check
                </>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
