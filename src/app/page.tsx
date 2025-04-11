"use client";

import {useState} from 'react';
import {generateGifFromPdf, GifConfig} from '@/services/gif-generator';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Slider} from "@/components/ui/slider";
import {Switch} from "@/components/ui/switch";
import {useToast} from "@/hooks/use-toast";
import {Icons} from "@/components/icons";
import {SelectItem, SelectTrigger, SelectValue, SelectContent, SelectGroup, Select, SelectLabel} from "@/components/ui/select";

export default function Home() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gifConfig, setGifConfig] = useState<GifConfig>({
    frameRate: 10,
    resolution: '500x500',
    looping: true,
  });
  const {toast} = useToast();
  const [resolution, setResolution] = useState("500x500");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === 'application/pdf') {
        setPdfFile(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF file.",
          variant: "destructive",
        });
        // Optionally clear the input field
        event.target.value = "";
      }

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
    try {
      const blob = await generateGifFromPdf(pdfFile, gifConfig);
      const url = URL.createObjectURL(blob);
      setGifUrl(url);
      toast({
        title: "GIF generated successfully!",
        description: "You can now download the GIF.",
        duration: 5000,
      });
    } catch (error) {
      console.error("Error generating GIF:", error);
      toast({
        title: "Error generating GIF.",
        description: "There was an error generating the GIF. Please try again.",
        variant: "destructive",
      });
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
    link.download = 'generated.gif';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(gifUrl); // Clean up the URL object
  };

  const handleFrameRateChange = (value: number[]) => {
    setGifConfig({...gifConfig, frameRate: value[0]});
  };

  const handleLoopingChange = (checked: boolean) => {
    setGifConfig({...gifConfig, looping: checked});
  };

  const handleResolutionChange = (value: string) => {
    setResolution(value);
    setGifConfig({...gifConfig, resolution: value});
  }


  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-background p-8">
      <h1 className="text-4xl font-bold mb-8">PDF to GIF Converter</h1>

      <Card className="w-full max-w-md mb-8">
        <CardHeader>
          <CardTitle>Upload PDF File</CardTitle>
          <CardDescription>Select a PDF file from your computer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Label htmlFor="pdf-upload" className="cursor-pointer">
              <Button variant="secondary" asChild>
                <label htmlFor="pdf-upload" className="flex items-center space-x-2 cursor-pointer">
                  <span>Upload PDF</span>
                  <Icons.file className="h-4 w-4"/>
                </label>
              </Button>
            </Label>
            <Input id="pdf-upload" type="file" accept="application/pdf" className="hidden"
                   onChange={handleFileChange}/>
            {pdfFile && <span className="text-sm">{pdfFile.name}</span>}
          </div>
        </CardContent>
      </Card>

      <Card className="w-full max-w-md mb-8">
        <CardHeader>
          <CardTitle>GIF Configuration</CardTitle>
          <CardDescription>Customize the GIF settings</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="frame-rate">Frame Rate ({gifConfig.frameRate} FPS)</Label>
            <Slider
              id="frame-rate"
              defaultValue={[gifConfig.frameRate]}
              max={30}
              step={1}
              onValueChange={handleFrameRateChange}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="looping">Looping</Label>
            <Switch
              id="looping"
              checked={gifConfig.looping}
              onCheckedChange={handleLoopingChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resolution">Resolution</Label>
            <Select onValueChange={handleResolutionChange} defaultValue={resolution}>
              <SelectTrigger id="resolution">
                <SelectValue placeholder="Select resolution" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Resolution</SelectLabel>
                  <SelectItem value="250x250">
                    250x250
                  </SelectItem>
                  <SelectItem value="500x500">
                    500x500
                  </SelectItem>
                  <SelectItem value="750x750">
                    750x750
                  </SelectItem>
                  <SelectItem value="1000x1000">
                    1000x1000
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex space-x-4 mb-8">
        <Button onClick={handleGenerateGif} disabled={loading}>
          {loading ? (
            <>
              <Icons.loader className="mr-2 h-4 w-4 animate-spin"/>
              <span>Generating...</span>
            </>
          ) : (
            "Convert PDF to GIF"
          )}
        </Button>
        {gifUrl && (
          <Button variant="accent" onClick={handleDownloadGif} className="mt-4">
            <Icons.arrowRight className="mr-2 h-4 w-4"/>
            Download GIF
          </Button>
        )}
      </div>
    </div>
  );
}
