const config = {
  projectName: "小学AI出题助手",
  date: "2026-05-15",
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: "src",
  outputRoot: "dist",
  framework: "react",
  enableSourceMap: false,
  compiler: {
    type: "webpack5",
    prebundle: {
      enable: false
    }
  },
  cache: {
    enable: false
  },
  copy: {
    patterns: [
      {
        from: "src/assets/generated",
        to: "dist/assets/generated"
      }
    ],
    options: {}
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {}
      },
      cssModules: {
        enable: false
      }
    }
  },
  h5: {},
  plugins: []
};

module.exports = function () {
  return config;
};
