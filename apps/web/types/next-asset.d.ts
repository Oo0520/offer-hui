// Next.js 资源导入类型声明（?url 后缀：webpack/turbopack asset 模块）
declare module "*?url" {
  const src: string;
  export default src;
}
