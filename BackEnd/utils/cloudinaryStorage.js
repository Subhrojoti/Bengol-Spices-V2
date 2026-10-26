import { pipeline } from "node:stream";

// The previous adapter requires the vulnerable Cloudinary 1.x SDK. Keep the
// same Multer file contract while using Cloudinary's supported upload_stream API.
export const cloudinaryStorage = ({ cloudinary, params }) => ({
  _handleFile(req, file, callback) {
    let settled = false;
    let stream;
    const abort = () => stream?.destroy(new Error("Upload request was aborted"));
    const done = (error, info) => {
      if (settled) return;
      settled = true;
      req.off("aborted", abort);
      callback(error, info);
    };
    Promise.resolve().then(() => params(req, file)).then((options) => {
      if (req.aborted) return done(new Error("Upload request was aborted"));
      stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) return done(error);
        // An upstream failure may finish after a disconnect. Do not leak a
        // successfully uploaded asset whose form is already being rejected.
        if (settled) {
          if (result?.public_id) cloudinary.uploader.destroy(result.public_id, { invalidate: true }).catch(() => {});
          return;
        }
        if (!result?.public_id || !result?.secure_url) return done(new Error("File upload was not confirmed"));
        done(null, { path: result.secure_url, filename: result.public_id, size: result.bytes });
      });
      req.once("aborted", abort);
      pipeline(file.stream, stream, (error) => { if (error) done(error); });
    }).catch(done);
  },
  _removeFile(req, file, callback) {
    cloudinary.uploader.destroy(file.filename, { invalidate: true }, callback);
  },
});
