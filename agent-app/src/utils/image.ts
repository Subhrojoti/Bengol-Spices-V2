import { PixelRatio } from "react-native";

/* Photos are stored on Cloudinary at the size they were uploaded, often
   several megabytes straight from a phone camera, and the app was
   downloading them whole to draw a thumbnail 48 points wide. Cloudinary
   can hand back a copy made to measure if the size is written into the
   address, so this asks for one no larger than the space it will fill on
   this screen, in the lightest format the phone understands.

   Only Cloudinary upload addresses are changed. Anything else (a local file
   just picked, another host, an address that already carries its own
   instructions) is returned exactly as it came. */

const UPLOAD = "/image/upload/";
// The sizes asked for, so a photo shown at 44 and at 48 points shares one download
const WIDTHS = [96, 160, 240, 400, 640, 960, 1280];

/**
 * @param url    the image's address as stored
 * @param points how wide it is drawn, in layout points
 */
export function sizedImage(url: string | null | undefined, points: number): string | undefined {
  if (!url) return undefined;

  const at = url.indexOf(UPLOAD);
  if (at < 0 || !url.includes("res.cloudinary.com")) return url;

  const rest = url.slice(at + UPLOAD.length);
  // Already has instructions of its own (they come before the version or folder)
  if (/^[a-z]{1,3}_[^/]+\//.test(rest) && !/^v\d+\//.test(rest)) return url;

  const wanted = Math.ceil(points * Math.min(PixelRatio.get(), 3));
  const width = WIDTHS.find((w) => w >= wanted) ?? WIDTHS[WIDTHS.length - 1];

  return `${url.slice(0, at + UPLOAD.length)}f_auto,q_auto,c_limit,w_${width}/${rest}`;
}
