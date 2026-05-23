
const multer=require('multer'), path=require('path'), fs=require('fs');
function uploader(folder){
 const uploadPath=path.join(__dirname,'..','public','uploads',folder);
 if(!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath,{recursive:true});
 const storage=multer.diskStorage({
  destination:(req,file,cb)=>cb(null,uploadPath),
  filename:(req,file,cb)=>cb(null,Date.now()+'-'+Math.round(Math.random()*1e9)+path.extname(file.originalname).toLowerCase())
 });
 return multer({storage,limits:{fileSize:5*1024*1024},fileFilter:(req,file,cb)=>file.mimetype.startsWith('image/')?cb(null,true):cb(new Error('Only images allowed'))});
}
module.exports={productUpload:uploader('products'),bannerUpload:uploader('banners')};
