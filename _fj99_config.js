/*配置文件*/

// 自动判断环境：根据路径判断是否为测试环境
// 测试环境路径包含 /test/，如：http://120.35.29.232:9090/test/pc/#/，后端接口入口为：http://120.35.29.232:9090/test/pc/service/
// 仿真环境IP路径包含 19091，如：http://120.35.29.232:19091/#/，后端接口入口为：http://120.35.29.232:19091/bys/pc/service/
// 仿真环境域名路径包含 /fz/，如：https://www.fj99.org.cn/bys/fz/#/，后端接口入口为：https://www.fj99.org.cn/bys/fz/pc/service/
// 生产环境路径包含 /bys/，如：https://www.fj99.org.cn/bys/#/，后端接口入口为：https://www.fj99.org.cn/bys/pc/service/
// let isTestEnv = window.location.pathname.indexOf('/test/') !== -1;

window.configJs = {
    // 根据环境自动选择 API_PATH
    API_PATH: (function() {
        const path = window.location.pathname;
        const port = window.location.port;

        if (path.includes('/bys/test/')) return 'bys/test/pc/service/';
        if (path.includes('/bys/fz/')) return 'bys/fz/pc/service/';
        if (path.includes('/bys/')) return 'bys/pc/service/';
        if (port === '9090' && path.includes('/test/')) return 'test/pc/service/';
        if (port === '9090') return 'pc/service/';
        if (port === '19091') return 'bys/pc/service/';
        return 'pc/service/';
    })(),

    // 根据环境自动选择 PUBLIC_PATH
    PUBLIC_PATH: (function() {
        const path = window.location.pathname;
        const port = window.location.port;
        const hostname = window.location.hostname;

        if (path.includes('/bys/test/')) return '/bys/test/pc/';
        if (path.includes('/bys/fz/')) return '/bys/fz';
        if (path.includes('/bys/')) return '/bys/';
        if (port === '9090' && path.includes('/test/')) return '/test/pc';
        if (port === '9090') return '/pc';
        if (port === '19091') return '/';
        if (hostname === '10.200.58.103') return '/';
        return '/';
    })(),

    CERTIFICATE_LIBRARY_PATH:"dzzz/service/",
    SESSION_PREFIX: 'bsplatform_',
    LAYOUT_CONFIG: '2', // 设置默认使用的布局：1|2|3,    1 - 左右布局（菜单左侧）  2 - 上下布局（菜单左侧） 3 - 上下布局 （菜单顶部）
    THEME_CONFIG: '2|4', // 设置默认使用布局和风格：1|2,   风格：1 - 大  2 - 中 3 - 小
    THEME: true, // 是否启用风格
    PAGE_MODE: '0' ,// 页面显示模式： 0 - tab+iframe模式， 1 - 单页模式
    dddlUrl:'/bys/dddl',//单点登录
};
