"use client";

import { useState, useEffect, useCallback } from 'react';
import { generateGifFromPdf, GifConfig } from '@/services/gif-generator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Icons } from "@/components/icons";
import { SelectItem, SelectTrigger, SelectValue, SelectContent, SelectGroup, Select, SelectLabel } from "@/components/ui/select";


const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function GifGenerator() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [gifConfig, setGifConfig] = useState<GifConfig>({
    frameRate: 10,
    resolution: '500xauto',
    looping: true,
  });
  const { toast } = useToast();
  const [resolution, setResolution] = useState("500xauto");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const revokeGifUrl = useCallback(() => {
    if (gifUrl) {
      URL.revokeObjectURL(gifUrl);
      console.log("Revoked object URL:", gifUrl);
      setGifUrl(null);
    }
  }, [gifUrl]);

  useEffect(() => {
    // This effect handles cleanup when the component unmounts
    // or when gifUrl itself changes *before* a new one is set.
    const currentUrl = gifUrl;
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        console.log("Revoked object URL on cleanup:", currentUrl);
      }
    };
  }, [gifUrl]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type !== 'application/pdf') {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF file.",
          variant: "destructive",
        });
        event.target.value = ""; 
        setPdfFile(null);
        revokeGifUrl();
        setProgress(0);
        return;
      }

      if (file.size > MAX_PDF_SIZE_BYTES) {
        toast({
          title: "File too large",
          description: `Please select a PDF file smaller than ${MAX_PDF_SIZE_BYTES / 1024 / 1024}MB.`,
          variant: "destructive",
        });
        event.target.value = "";
        setPdfFile(null);
        revokeGifUrl();
        setProgress(0);
        return;
      }
      
      setPdfFile(file);
      revokeGifUrl(); // Revoke previous URL if exists
      setProgress(0); // Reset progress
    }
  };

  const handleGenerateGif = async () => {
    if (!pdfFile) {
      toast({
        title: "No PDF file selected.",
        description: "Please upload a PDF file to convert.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setProgress(0); 
    revokeGifUrl(); // Revoke previous URL before generating a new one
    console.log("Starting GIF generation with config:", gifConfig);

    try {
      const blob = await generateGifFromPdf(pdfFile, gifConfig, (p) => {
         setProgress(p); 
      });
      console.log("Generated GIF blob:", blob);
      if (blob && blob.size > 0) {
        const newGifUrl = URL.createObjectURL(blob);
        console.log("Created object URL:", newGifUrl);
        setGifUrl(newGifUrl); // Set the new URL
         toast({
            title: "GIF generated successfully!",
            description: "You can now preview and download the GIF.",
            className: "bg-green-500 text-white",
            duration: 5000,
         });
      } else {
           throw new Error("Generated GIF blob is empty or invalid.");
      }

    } catch (error) {
      console.error("Error generating GIF in component:", error);
      toast({
        title: "Error generating GIF.",
        description: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
       setGifUrl(null); 
       setProgress(0); 
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadGif = () => {
    if (!gifUrl) {
      toast({
        title: "No GIF available to download.",
        description: "Please generate a GIF first.",
        variant: "destructive",
      });
      return;
    }

    const link = document.createElement('a');
    link.href = gifUrl;
    link.download = `${pdfFile?.name.replace('.pdf', '') || 'generated'}.gif`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
     console.log("Download triggered for:", gifUrl);
  };

  const handleFrameRateChange = (value: number[]) => {
    setGifConfig({ ...gifConfig, frameRate: value[0] });
  };

  const handleLoopingChange = (checked: boolean) => {
    setGifConfig({ ...gifConfig, looping: checked });
  };

  const handleResolutionChange = (value: string) => {
    setResolution(value);
    setGifConfig({ ...gifConfig, resolution: value });
  }

  if (!isClient) {
    return (
       <div className="flex items-center justify-center min-h-screen">
         <Icons.loader className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-background p-4 md:p-8">
      <header className="w-full py-6 mb-8">
        <h1 className="text-5xl font-bold text-center text-primary">PDF2GIF</h1>
        <p className="text-center text-muted-foreground mt-2">Easily convert your PDF files into animated GIFs</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <div className="space-y-6">
          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="text-2xl">1. Upload PDF</CardTitle>
              <CardDescription>Select a PDF file (max {MAX_PDF_SIZE_BYTES / 1024 / 1024}MB) from your computer.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                <Label htmlFor="pdf-upload" className="w-full">
                  <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors">
                    <Icons.fileUp className="w-10 h-10 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      {pdfFile ? pdfFile.name : "Click or drag PDF here"}
                    </span>
                  </div>
                </Label>
                <Input id="pdf-upload" type="file" accept="application/pdf" className="hidden"
                  onChange={handleFileChange} />
              </div>
            </CardContent>
            {pdfFile && (
               <CardFooter className="text-xs text-muted-foreground">
                 Selected: {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)
               </CardFooter>
            )}
          </Card>

          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="text-2xl">2. Configure GIF</CardTitle>
              <CardDescription>Adjust settings for your output GIF.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="frame-rate">Frame Rate</Label>
                  <span className="text-sm text-muted-foreground">{gifConfig.frameRate} FPS</span>
                </div>
                <Slider
                  id="frame-rate"
                  defaultValue={[gifConfig.frameRate]}
                  min={1}
                  max={30}
                  step={1}
                  onValueChange={handleFrameRateChange}
                  aria-label="Frame Rate"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resolution">Resolution</Label>
                <Select onValueChange={handleResolutionChange} defaultValue={resolution}>
                  <SelectTrigger id="resolution" aria-label="Resolution">
                    <SelectValue placeholder="Select resolution" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Resolution</SelectLabel>
                      <SelectItem value="250xauto">250px width (auto height)</SelectItem>
                      <SelectItem value="500xauto">500px width (auto height)</SelectItem>
                      <SelectItem value="750xauto">750px width (auto height)</SelectItem>
                      <SelectItem value="original">Original PDF Page Size</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground">
                  {resolution.includes('xauto') ? `Width set, height will adjust.` : `Match PDF page size.`}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="looping">Loop GIF</Label>
                <Switch
                  id="looping"
                  checked={gifConfig.looping}
                  onCheckedChange={handleLoopingChange}
                  aria-label="Loop GIF"
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleGenerateGif} disabled={loading || !pdfFile} className="w-full text-lg py-6 rounded-xl shadow-md">
            {loading ? (
              <>
                <Icons.loader className="mr-2 h-5 w-5 animate-spin" />
                <span>Generating GIF ({Math.round(progress * 100)}%)...</span>
              </>
            ) : (
              <>
                <Icons.sparkles className="mr-2 h-5 w-5" />
                <span>Convert to GIF</span>
              </>
            )}
          </Button>
        </div>

        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="text-2xl">3. Preview & Download</CardTitle>
            <CardDescription>Your generated GIF will appear here.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-full min-h-[300px]">
            {loading && (
              <div className="flex flex-col items-center text-muted-foreground">
                <Icons.loader className="h-12 w-12 animate-spin mb-4" />
                <p>Processing PDF and generating GIF...</p>
                <p className="text-sm">Progress: {Math.round(progress * 100)}%</p> 
                <p className="text-sm">This may take a few moments.</p>
              </div>
            )}
            {!loading && gifUrl && (
              <div className="w-full max-w-md" data-ai-hint="animation motion">
                <img
                    src={gifUrl}
                    alt="Generated GIF Preview"
                    className="rounded-lg border"
                    style={{ maxWidth: '100%', height: 'auto' }}
                    onError={(e) => {
                         console.error("Error loading GIF preview:", e);
                         toast({ title: "Error loading preview", description: "The generated GIF might be corrupted or the URL is invalid.", variant: "destructive" });
                         revokeGifUrl(); 
                    }}
                 />
              </div>
            )}
            {!loading && !gifUrl && !pdfFile && (
              <div className="text-center text-muted-foreground">
                <Icons.imageOff className="h-16 w-16 mx-auto mb-4" />
                <p>Upload a PDF and configure settings to generate a GIF.</p>
              </div>
            )}
             {!loading && !gifUrl && pdfFile && (
              <div className="text-center text-muted-foreground">
                <Icons.fileImage className="h-16 w-16 mx-auto mb-4" />
                <p>Click "Convert to GIF" to see your preview.</p>
              </div>
            )}
          </CardContent>
          {gifUrl && !loading && (
            <CardFooter className="flex justify-center">
              <Button variant="default" onClick={handleDownloadGif} className="text-lg py-6 rounded-xl shadow-md">
                <Icons.download className="mr-2 h-5 w-5" />
                Download GIF
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
       <footer className="w-full text-center mt-12 py-6 border-t">
        <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} PDF2GIF. All rights reserved.</p>
      </footer>
    </div>
  );
}


export default function Home() {
  return <GifGenerator />;
}

