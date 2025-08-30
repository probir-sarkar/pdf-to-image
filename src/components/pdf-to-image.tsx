import { useCallback, useMemo, useState } from "react"
import Dropzone from "./dropzone"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import JSZip from "jszip"
import { getDocument } from "pdfjs-dist/build/pdf.mjs"

const pdfOptions = { disableWorker: true }

type ImageResult = {
  page: number
  blob: Blob
  url: string
  width: number
  height: number
  filename: string
}

export default function PdfToImage() {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<"png" | "jpeg">("png")
  const [quality, setQuality] = useState<number>(92) // for jpeg
  const [scale, setScale] = useState<number>(2.0) // 2x scale by default
  const [startPage, setStartPage] = useState<number>(1)
  const [endPage, setEndPage] = useState<number | null>(null)
  const [images, setImages] = useState<ImageResult[]>([])
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const baseName = useMemo(() => {
    if (!file) return "export"
    const name = file.name.replace(/\.pdf$/i, "")
    return name.length ? name : "export"
  }, [file])

  const onFiles = useCallback((files: FileList | File[]) => {
    const f = Array.from(files)[0]
    if (!f) return
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file.")
      return
    }
    setError(null)
    setImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.url))
      return []
    })
    setFile(f)
    setStartPage(1)
    setEndPage(null)
    console.log("[v0] PDF selected:", f.name, f.size)
  }, [])

  async function convert() {
    if (!file) return
    setConverting(true)
    setProgress(0)
    setError(null)
    const fr = new FileReader()

    const arrayBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
      fr.onload = () => resolve(fr.result as ArrayBuffer)
      fr.onerror = () => reject(fr.error)
      fr.readAsArrayBuffer(file)
    })

    try {
      const loadingTask = getDocument({ data: arrayBuffer, ...pdfOptions })
      const pdf = await loadingTask.promise
      const total = pdf.numPages
      const start = Math.max(1, startPage || 1)
      const end = Math.min(
        Number.isFinite(endPage as number) && (endPage as number) > 0 ? (endPage as number) : total,
        total,
      )
      if (start > end) throw new Error("Invalid page range.")

      const results: ImageResult[] = []
      for (let pageNum = start; pageNum <= end; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d", { willReadFrequently: false })

        canvas.width = viewport.width
        canvas.height = viewport.height

        await page.render({ canvasContext: context as CanvasRenderingContext2D, viewport }).promise

        const type = format === "png" ? "image/png" : "image/jpeg"
        const qualityRatio = format === "jpeg" ? Math.min(Math.max(quality / 100, 0.1), 1.0) : undefined

        const blob: Blob = await new Promise((resolve) => {
          if (format === "png") {
            canvas.toBlob((b) => resolve(b as Blob), type)
          } else {
            canvas.toBlob((b) => resolve(b as Blob), type, qualityRatio)
          }
        })

        const filename = `${baseName}-p${String(pageNum).padStart(2, "0")}.${format}`
        const url = URL.createObjectURL(blob)
        results.push({
          page: pageNum,
          blob,
          url,
          width: canvas.width,
          height: canvas.height,
          filename,
        })
        setProgress(Math.round(((pageNum - start + 1) / (end - start + 1)) * 100))
      }

      setImages((prev) => {
        prev.forEach((img) => URL.revokeObjectURL(img.url))
        return results
      })
      console.log("[v0] Conversion complete. Pages:", results.length)
    } catch (e) {
      const msg = (e as Error).message || "Failed to convert PDF."
      setError(msg)
      console.log("[v0] Conversion error:", msg)
    } finally {
      setConverting(false)
    }
  }

  async function downloadAllZip() {
    if (!images.length) return
    const zip = new JSZip()
    const folder = zip.folder(baseName) as JSZip
    images.forEach((img) => folder.file(img.filename, img.blob))
    const blob = await zip.generateAsync({ type: "blob" })
    triggerDownload(blob, `${baseName}-images.zip`)
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">PDF to Image Converter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Dropzone onFiles={onFiles} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as "png" | "jpeg")}>
                <SelectTrigger id="format" className="w-full">
                  <SelectValue placeholder="Choose format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG (lossless)</SelectItem>
                  <SelectItem value="jpeg">JPEG (smaller)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scale">Quality / Scale</Label>
              <Select value={String(scale)} onValueChange={(v) => setScale(Number.parseFloat(v))}>
                <SelectTrigger id="scale" className="w-full">
                  <SelectValue placeholder="Choose scale" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Fast (1x)</SelectItem>
                  <SelectItem value="1.5">Balanced (1.5x)</SelectItem>
                  <SelectItem value="2">Sharp (2x)</SelectItem>
                  <SelectItem value="3">Ultra (3x)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Higher scale increases clarity and file size.</p>
            </div>

            {format === "jpeg" ? (
              <div className="space-y-2">
                <Label htmlFor="quality">JPEG Quality ({quality}%)</Label>
                <input
                  id="quality"
                  type="range"
                  min={50}
                  max={100}
                  step={1}
                  value={quality}
                  onChange={(e) => setQuality(Number.parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">Lower quality = smaller files.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="opacity-0">Spacer</Label>
                <div className="text-sm text-muted-foreground">PNG is lossless by default.</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="start">Start Page</Label>
              <Input
                id="start"
                inputMode="numeric"
                value={startPage}
                onChange={(e) => setStartPage(Number.parseInt(e.target.value || "1"))}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End Page (blank = all)</Label>
              <Input
                id="end"
                inputMode="numeric"
                value={endPage ?? ""}
                onChange={(e) => setEndPage(e.target.value ? Number.parseInt(e.target.value) : null)}
                placeholder="e.g. 10"
              />
            </div>
            <div className="space-y-2">
              <Label className="opacity-0">Convert</Label>
              <Button onClick={convert} disabled={!file || converting} className="w-full">
                {converting ? "Converting…" : "Convert"}
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="opacity-0">Download</Label>
              <Button variant="secondary" onClick={downloadAllZip} disabled={!images.length} className="w-full">
                Download ZIP
              </Button>
            </div>
          </div>

          {converting ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processing</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {images.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {images.map((img) => (
            <Card key={img.page}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Page {img.page} · {img.width}×{img.height}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <img
                  src={img.url || "/placeholder.svg"}
                  alt={`Page ${img.page} preview`}
                  className="w-full rounded-md border"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => triggerDownload(img.blob, img.filename)}>
                    Download
                  </Button>
                  <span className="text-xs text-muted-foreground">{img.filename}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="text-xs text-muted-foreground">
        Privacy: All processing happens in your browser. No files are uploaded.
      </div>
    </div>
  )
}
