const cloud = require('wx-server-sdk')
const axios = require('axios')
const dayjs = require('dayjs')
cloud.init({
  env:cloud.DYNAMIC_CURRENT_ENV,
})
// 云函数入口函数
exports.main = async (event, context) => {
  // 图片压缩
  const imgInfo = await imageMinify(event)
  // 获取图片buffer
  const buffer = await getBuffer(imgInfo.filePath)
  // 图片校验
  try {
    const imgResult = await cloud.openapi.security.imgSecCheck({
      media:{
        header: {'content-Type': 'application/octe-stream'},
        contentType: `image/${imgInfo.type}`,
        value: buffer
      }
    })
    // 上传原图到CDN
    imgResult.fileId = await uploadImage(event.filePath, event.type)
    return imgResult
  } catch (error) {
    // 校验含有敏感信息
    return error
  }
}

// 图片压缩
async function imageMinify (imgInfo) {
  const { width, height, filePath, type } = imgInfo
  if ((width > 750 && height > 750) || width > 1334 || height > 1334) {
    const imgSize = getImageSize({ width, height })
    const { result } = await cloud.callFunction({
      name: 'imageCompose',
      data: {
        imageType: 'jpg',
        dataType: 'url',
        data: [{ ...imgSize, src: filePath }]
      }
    })
    return {
      width: imgSize.width,
      height: imgSize.height,
      filePath: result.value,
      type: result.imageType
    }
  } else {
    return imgInfo
  }
}

// 计算压缩后的图片宽高
function getImageSize (imgInfo) {
  let width = 0, height = 0
  if (imgInfo.width > imgInfo.height) {
    width = 750
    height = 750 * imgInfo.height / imgInfo.width
  } else if (imgInfo.height > imgInfo.width) {
    height = 750
    width = 750 * imgInfo.width / imgInfo.height
  } else {
    width = height = 750
  }
  return {
    width,
    height
  }
}

// 获取图片buffer
async function getBuffer (path) {
  const { data } = await axios({
    method: 'get',
    url: path,
    responseType: 'arraybuffer',
  })
  return data
}

// 上传图片到云存储
async function uploadImage (path, type) {
  const imgName = `${Date.now()}-${Math.random()}.${type}`
  const imgBuffer = await getBuffer(path)
  const fileID = await cloudUploadFile(`tmp/${dayjs().format('YYYY-MM-DD')}/${imgName}`, imgBuffer)
  const db = cloud.database()
  db.collection('tmp-file').add({ data: { time: Date.now(), fileID: fileID } })
  return fileID
}

// 上传图片到云存储，返回图片id
async function cloudUploadFile (cloudPath, fileContent) {
	return (await cloud.uploadFile({ cloudPath, fileContent })).fileID
}
