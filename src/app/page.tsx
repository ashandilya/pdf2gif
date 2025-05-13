"use client";

import { useState, useEffect, useCallback } from 'react';
import { generateGifFromPdf, GifConfig as OriginalGifConfig } from '@/services/gif-generator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Icons } from "@/components/icons";
import { SelectItem, SelectTrigger, SelectValue, SelectContent, SelectGroup, Select, SelectLabel } from "@/components/ui/select";
import { Moon, Sun, FolderSearch } from "lucide-react";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// SVGs for Dropbox and Google Drive
const DropboxIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 3L12 6.5L7 9.5L1.5 6L6.5 3ZM12 6.5L17.5 3L22.5 6L17 9.5L12 6.5ZM1.5 13L7 16.5L12 13L6.5 9.5L1.5 13ZM12 13L17 16.5L22.5 13L17.5 9.5L12 13ZM7 18.5L12 21.5L17 18.5L12 15.5L7 18.5Z" fill="white"/></svg>
);
const GoogleDriveIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 3L1 14L4.5 20.5H19.5L23 14L16.5 3H7.5ZM7.5 5H16.5L21.5 14L18.5 19H5.5L2.5 14L7.5 5ZM12 7.5L8.5 14H15.5L12 7.5Z" fill="white"/></svg>
);

// Extend GifConfig to include pageRange
interface GifConfig extends OriginalGifConfig {
  pageRange?: string;
}

function GifGenerator() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [gifConfig, setGifConfig] = useState<GifConfig>({
    frameRate: 10,
    resolution: '500xauto',
    looping: true,
    pageRange: '',
  });
  const { toast } = useToast();
  const [resolution, setResolution] = useState("500xauto");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Check system preference for theme
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    // Apply theme to document
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

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
      
      // Start generating GIF immediately when file is selected
      handleGenerateGif(file);
    }
  };

  const handleGenerateGif = async (file?: File) => {
    const pdfToUse = file || pdfFile;
    if (!pdfToUse) {
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
      const blob = await generateGifFromPdf(pdfToUse, gifConfig, (p) => {
         setProgress(p); 
      });
      console.log("Generated GIF blob:", blob);
      if (blob && blob.size > 0) {
        const newGifUrl = URL.createObjectURL(blob);
        console.log("Created object URL:", newGifUrl);
        setGifUrl(newGifUrl); // Set the new URL
         toast({
            title: "GIF generated successfully!",
            description: "You can now download the GIF.",
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

  const handleDownload = () => {
    if (gifUrl) {
      const link = document.createElement('a');
      link.href = gifUrl;
      link.download = `${pdfFile?.name.replace('.pdf', '') || 'converted'}.gif`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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

  useEffect(() => {
    if (pdfFile) {
      handleGenerateGif(pdfFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gifConfig.frameRate, gifConfig.resolution, gifConfig.looping]);

  if (!isClient) {
    return (
       <div className="flex items-center justify-center min-h-screen">
         <Icons.loader className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-background p-2 sm:p-4 md:p-8">
      <header className="w-full max-w-4xl flex flex-col items-center py-4 sm:py-6 mb-4 sm:mb-8">
        <h1 className="text-3xl sm:text-5xl font-bold text-primary text-center mb-2">PDF2GIF</h1>
        <div className="flex justify-end w-full mb-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>
        </div>
        <p className="text-center text-muted-foreground mt-2 text-sm sm:text-base">Easily convert your PDF files into animated GIFs</p>
        <p className="text-center text-muted-foreground mt-2 text-xs sm:text-base">
          Know the person behind this? <a href="https://www.linkedin.com/in/ashandilya64/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Connect on LinkedIn</a>
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 w-full max-w-4xl min-h-[560px]">
        <div className="flex flex-col space-y-4 sm:space-y-6 h-full min-h-[560px]">
          <Card className="shadow-2xl rounded-xl w-full max-w-full flex flex-col justify-center overflow-hidden box-border bg-red-600 min-h-[110px] max-h-[110px]">
            <Label htmlFor="pdf-upload" className="w-full cursor-pointer h-full flex flex-col justify-center">
              <div className="flex items-center justify-between w-full px-4 py-4 h-full">
                <span className="text-white font-semibold text-base sm:text-lg">Choose Files</span>
                <div className="flex items-center space-x-4">
                  <FolderSearch className="w-6 h-6 text-white opacity-90" />
                  <span className="w-6 h-6">{DropboxIcon()}</span>
                  <span className="w-6 h-6">{GoogleDriveIcon()}</span>
                </div>
              </div>
              <Input id="pdf-upload" type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
              <div className="w-full px-4 pb-1 pt-1">
                <p className="text-xs text-white/80 flex items-center">
                  <span className="mr-1">🔒</span> Drop files here. 50 MB maximum file size
                </p>
              </div>
            </Label>
          </Card>
          <Card className="shadow-2xl rounded-xl w-full max-w-full min-h-[210px] max-h-[210px] flex flex-col justify-center bg-white dark:bg-black p-4 sm:p-6">
            <CardHeader className="p-0 pb-2">
              <CardTitle className="text-lg sm:text-xl">2. Configure GIF</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Adjust settings for your output GIF.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:gap-4 flex-1 flex flex-col justify-center p-0">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="frame-rate">Frame Rate</Label>
                  <span className="text-xs sm:text-sm text-muted-foreground">{gifConfig.frameRate} FPS</span>
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
              <div className="space-y-2">
                <Label htmlFor="page-range">Page Range</Label>
                <Input
                  id="page-range"
                  type="text"
                  placeholder="e.g. 1-3,5,7"
                  value={gifConfig.pageRange}
                  onChange={e => setGifConfig({ ...gifConfig, pageRange: e.target.value })}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">Enter page numbers or ranges (e.g. 1-3,5,7). Leave blank for all pages.</p>
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
        </div>
        <Card className="shadow-2xl rounded-xl h-full flex flex-col justify-between w-full max-w-full min-h-[320px] max-h-[320px] bg-white dark:bg-black p-4 sm:p-6">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">3. Preview & Download</CardTitle>
            <CardDescription className="text-xs sm:text-base">Your generated GIF will appear here.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-1 w-full max-w-full" style={{ minHeight: '200px', maxHeight: '400px' }}>
            {loading && (
              <div className="flex flex-col items-center text-muted-foreground">
                <Icons.loader className="h-10 w-10 sm:h-12 sm:w-12 animate-spin mb-4" />
                <p className="text-xs sm:text-base">Processing PDF and generating GIF...</p>
                <p className="text-xs sm:text-sm">Progress: {Math.round(progress * 100)}%</p> 
                <p className="text-xs sm:text-sm">This may take a few moments.</p>
              </div>
            )}
            {!loading && gifUrl && (
              <div className="w-full h-full flex items-center justify-center overflow-hidden" style={{ minHeight: '120px', maxHeight: '350px' }}>
                <img
                  src={gifUrl}
                  alt="Generated GIF Preview"
                  className="rounded-lg border object-contain w-full h-full max-h-full max-w-full"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
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
                <Icons.imageOff className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4" />
                <p className="text-xs sm:text-base">Upload a PDF to generate a GIF.</p>
              </div>
            )}
            {!loading && !gifUrl && pdfFile && (
              <div className="text-center text-muted-foreground">
                <Icons.fileImage className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4" />
                <p className="text-xs sm:text-base">Processing your PDF...</p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={gifUrl ? handleDownload : () => handleGenerateGif()} 
              disabled={loading || !pdfFile} 
              className="w-full text-base sm:text-lg py-4 sm:py-6 rounded-xl shadow-md"
            >
              {loading ? (
                <>
                  <Icons.loader className="mr-2 h-5 w-5 animate-spin" />
                  <span>Generating GIF ({Math.round(progress * 100)}%)...</span>
                </>
              ) : gifUrl ? (
                <>
                  <Icons.download className="mr-2 h-5 w-5" />
                  <span>Download GIF</span>
                </>
              ) : (
                <>
                  <Icons.sparkles className="mr-2 h-5 w-5" />
                  <span>Convert to GIF</span>
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
      <footer className="w-full max-w-4xl text-center mt-8 sm:mt-12 py-4 sm:py-6 border-t">
        <p className="text-xs sm:text-sm text-muted-foreground">&copy; {new Date().getFullYear()} PDF2GIF. All rights reserved.</p>
      </footer>
    </div>
  );
}


export default function Home() {
  return <GifGenerator />;
}

