/**
 * 
 */
var Timer = require('./Timer.js');
var template = require('./video.mustache');
var TIMER_INTERVAL = 60;
var CONTROL_BAR_OPACITY = 0.5;
var TIME_HIDE_CONTROL = 5000;


function Mvideo (opts) {
  this.defaultOpts = {
    container: 'body',
    videoImg: '',
    video: '',
    needFullScreen: true
  };
  this.opts = $.extend({}, this.defaultOpts, opts || {});
  this.template = template;
  this.id = genUID();
  setup.call(this);
  return this;
}

module.exports = Mvideo;


/**
 * 初始化视频元素
 * 初始化事件
 * @return {[type]} [description]
 */
function setup() {
  this.container = $(this.opts.container);
  if (this.container.length === 0) {
    console.error('error: setup faild, can not select any element by container "'+container+'"');
    return;
  }

  this.opts.vid = this.id;
  this.opts.notApplePlatform = notApplePlatform();
  this.opts.supportH5Video = supportH5Video();
  this.opts.isIE = isIE();
  this.container.append(template.render(this.opts));

  this.$videoWrap = $('#wrap-' + this.id);
  this.videoDom = $('#' + this.id).get(0);

  if (!this.opts.supportH5Video) {
    // 如果不支持 <video> 标签
    // 判断 flash 插件版本是否小于 10.1
    if(getFlashPluginVersion() < 10.1) {
      // 不支持视频播放，需要更新 flash 版本
      this.$videoWrap.find('.js-no-version-flash').show();
      return;
    }
    // 这里把 videoDom 设置成普通对象
    this.flashVideo = this.videoDom;
    this.videoDom = {};
    videoDomReady.call(this, function() {
      var me = this;
      me.flashVideo.fl_setVideo_m4v(me.opts.video + '?id=' + me.id);
      me.flashVideo.fl_load();
      shimFlashVideo.call(me);
    });
  }
  
  this.$playBtn = this.$videoWrap.find('.js-play-btn');
  this.$pauseBtn = this.$videoWrap.find('.js-pause-btn');
  this.$controlBar = this.$videoWrap.find('.control-bar');
  this.$timeline = this.$videoWrap.find('.timeline');
  this.$timeflag = this.$videoWrap.find('.timeflag');
  this.$timeLoaded = this.$videoWrap.find('.timeline.loaded');
  this.$showTime = this.$videoWrap.find('.js-time-show');
  this.$loading = this.$videoWrap.find('.js-loading');
  this.$miniTimeline = this.$videoWrap.find('.js-mini-timeline');
  this.$miniTimeWrap = this.$videoWrap.find('.js-mini-time-bar');
  this.$fullScreen = this.$videoWrap.find('.js-control-btn');

  this.timer = new Timer(TIMER_INTERVAL);
  this.timeupdate = callBind(this, setTimeUpdate);
  this.loadedupdate = callBind(this, setTimeLoaded);

  initEvent.call(this);
}


/**
 * 初始化事件
 * @return {[type]} [description]
 */
function initEvent () {
  var me = this;
  var $videoDom = $(me.videoDom);

  // 点击播放按钮
  me.$playBtn.click(function(e) {
    e.stopPropagation();
    e.preventDefault();
    // 开始播放
    playVideo.call(me, true);
    // 几秒后自动隐藏工具栏
    showControlBar.call(me, true, 'autoHide');
  });

  // 点击暂停按钮
  me.$pauseBtn.click(function(e) {
    e.stopPropagation();
    e.preventDefault();
    if (me.isPlaying) {
      playVideo.call(me, false);
      // 几秒后自动隐藏工具栏
      showControlBar.call(me, true);
    }
    else {
      playVideo.call(me, true);
      showControlBar.call(me, true, 'autoHide');
    }
  });

  // 点击视频内容区域
  me.$videoWrap.on('click', function() {
    if (!me.isPlaying) {
      return;
    }
    if (me.controlBarShow) {
      showControlBar.call(me, false, 'autoHide');
    }
    else {
      showControlBar.call(me, true, 'autoHide');
    }
  });

  $videoDom.on('pause', function() {
    playVideo.call(me, false);
    me.timer.stop();
    me.timer.clear();
  });

  // 视频播放完毕
  $videoDom.on('ended', function() {
    playVideo.call(me, false);
    me.timer.stop();
    me.timer.clear();
  });

  // 全屏
  me.$fullScreen.click(function(e) {
    e.stopPropagation();
    e.preventDefault();
    if (me.isFullSceen) {
      // 关闭全屏
      me.isFullSceen = false;
      fullScreen.call(me, false);
    }
    else {
      // 打开全屏
      me.isFullSceen = true;
      fullScreen.call(me, true);
    }
    // 继续视频播放
    if (me.isPlaying) {
      playVideo.call(me, true, 'autoHide');
    }
  });
}


/**
 * 控制视频元素的播放与暂停
 * @param  {[type]} flag [description]
 * @return {[type]}      [description]
 */
function playVideo (flag) {
  var me = this;
  if (flag) {
    // 开始定时获取播放进度
    me.timer.add(me.timeupdate);
    // 更新加载进度
    if (!me.videoLoaded) {
      // 如果没有加载完成则添加此任务
      me.timer.add(me.loadedupdate);
    }
    // 启动定期器
    me.timer.start();
    // 播放视频
    me.videoDom.play();
    // 标记已经开始播放
    me.isPlaying = true;
    // 隐藏播放按钮
    me.$playBtn.hide();
    // 设置工具栏的播放按钮为 暂停 样式
    me.$pauseBtn.removeClass('play').addClass('pause');
  }
  else {
    // 从定时器中移除更新播放进度的任务
    me.timer.remove(me.timeupdate);
    me.videoDom.pause();
    me.isPlaying = false;
    me.$playBtn.show();
    me.$controlBar.css('opacity', CONTROL_BAR_OPACITY);
    // 设置工具栏的播放按钮为 播放 样式
    me.$pauseBtn.removeClass('pause').addClass('play');
  }
}


// 更新播放进度
function setTimeUpdate () {
  var me = this;
  var videoDom = me.videoDom;
  var duration = videoDom.duration || 0;
  var currentTime = videoDom.currentTime || 0;

  // 计算剩余时间
  var showTime = computeShowTime(currentTime) + '/' + computeShowTime(duration);
  me.$showTime.text(showTime);

  // 设置进度条位置
  // 移动标记
  me.$timeflag.css('left', currentTime/duration * 100 + '%');
  // 设置迷你时间线的进度
  me.$miniTimeline.css('width', Math.ceil(currentTime/duration * 100) + '%');
  // console.log(currentTime, speed, left, duration);
}


/**
 * 把秒转换为 时:分:秒 => 0:00:00
 * @param  {[type]} seconds [description]
 * @return {[type]}         [description]
 */
function computeShowTime (seconds) {
  // 计算小时
  var hour = parseInt(seconds / (60 * 60));
  hour = hour === 0 ? '' : (hour + ':');
  // 计算分钟
  var minute = parseInt(seconds / 60);
  minute = minute.toString().length === 1 ? ('0' + minute) : minute;
  // 计算秒
  var second = Math.round(seconds % 60, 0);
  second = second.toString().length === 1 ? ('0' + second) : second;
  // 设置剩余时间
  var showTime = hour + minute + ':' + second;
  return showTime
}


// 设置下载进度
// 获取视频已经下载的时长
function setTimeLoaded() {
  var me = this;
  var videoDom = me.videoDom;
  var duration = videoDom.duration || 0;
  var currentTime = videoDom.currentTime || 0;
  var end = 0;
  // 获取已经下载的时长
  try {
    end = videoDom.buffered.end(0) || 0;
    end += 0.1;
  } catch(e) {
  }

  // 根据加载时间判断视频当前的加载状态
  if (!me.videoLoaded && (currentTime === 0 || end <= currentTime)) 
  {
    // 视频正在缓冲
    if (!me.isLoading) {
      showLoading.call(me, true);
    }
    me.isLoading = true;
    return;
  }
  else if (!me.videoLoaded && duration - end < 0.1) {
    // 进来这里就代表加载完成了
    // 如果视频总时间 - 已经加载的时间 < 0.1 
    me.videoLoaded = true;
    me.timer.remove(me.loadedupdate);
  }

  if (me.isLoading) {
    showLoading.call(me, false);
  }
  me.isLoading = false;

  // 设置进度条位置
  me.$timeLoaded.css('width', end/duration * 100 + '%');
  // console.log(end, speed, loadedWidth, duration);
}


/**
 * 显示加载中
 * @param  {[type]} arguments [description]
 * @return {[type]}           [description]
 */
function showLoading (flag) {
  var me = this;
  // 显示加载进度
  if (flag) {
    me.$loading.show();
  }
  else {
    me.$loading.hide();
  }
}


/**
 * 控制工具栏的显示隐藏
 * @param  {[type]} flag [description]
 * @return {[type]}      [description]
 */
function showControlBar (flag, autoHide) {
  var me = this;
  if (flag) {
    me.controlBarShow = true;
    me.$controlBar.css('opacity', CONTROL_BAR_OPACITY);
    showMiniTimeBar.call(me, false);
  }
  else {
    me.controlBarShow = false;
    me.$controlBar.css('opacity', 0);
    showMiniTimeBar.call(me, true);
  }

  if (me.controlBarTimer) {
    clearTimeout(me.controlBarTimer);
    me.controlBarTimer = null;
  }

  if (flag && !me.controlBarTimer && autoHide === 'autoHide') {
    me.controlBarTimer = setTimeout(function() {
      me.$controlBar.css('opacity', 0);
      me.controlBarTimer = null;
      me.controlBarShow = false;
      showMiniTimeBar.call(me, true);
    }, TIME_HIDE_CONTROL);
  }
}


/**
 * 控制复制进度条的显示隐藏
 */
function showMiniTimeBar (flag) {
  var me = this;
  if (flag) {
    me.$miniTimeWrap.show();
  }
  else {
    me.$miniTimeWrap.hide();
  }
}


/**
 * 全屏操作
 * @return {[type]} [description]
 */
function fullScreen (flag) {
  var me = this;
  var $win = $(window);
  var w = $win.width();
  var h = $win.height();
  if (flag) {
    // 启动全屏
    me.isFullSceen = true;
    // 创建一个最高优先级弹层，全屏状态
    var layId = '__mvideo_lay_' + me.id;
    me.overlayId = layId;
    me.$fullScreenLay = $('body').append(
        '<div id="'+ layId +'" class="mvideo-overlay" style="width: '+ w +'px;height:'+ h +'px"></div>'
      );
    // 记录视频组件之前的DOM位置
    var id = '__mark_' + me.id;
    me.markDomId = id;
    me.$videoWrap.before('<div id="'+ id +'" style="display:none;"></div>');
    // 把视频组件移入弹层中， 并根据横竖屏状态旋转视频组件
    $('#' + layId).append(me.$videoWrap);
    me.$videoWrap.css({
      transform: 'rotate3d(0, 0, 1, 90deg)',
      width: h,
      height: w,
      position: 'absolute',
      top: (h - w)/2,
      left: -(h - w)/2
    });
  }
  else {
    // 取消全屏
    me.isFullSceen = false;
    // 移除旋转状态
    me.$videoWrap.css({
      transform: 'none',
      width: '100%',
      height: '100%',
      position: 'relative',
      top: 0,
      left: 0
    });
    // 把视频组件放回原来的DOM位置
    var $markDom = $('#' + me.markDomId);
    $markDom.before(me.$videoWrap);
    $markDom.remove();
    // 删除弹层
    $('#' + me.overlayId).remove();
  }

}


/**
 * 生成唯一ID
 * @return {[type]} [description]
 */
function genUID () {
  return 'mvideo-' + $.now() + 
            (Math.random() * 10).toString().substring(0, 1);
}


/**
 * bind function
 * @param  {[type]} obj  [description]
 * @param  {[type]} func [description]
 * @return {[type]}      [description]
 */
function callBind (obj, func) {
  return (function(obj) {
    return function() {
      func.call(obj);
    };
  })(obj);
}


function notApplePlatform () {
  var ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1) {
    return false;
  }
  return true;
}


function isIE () {
  var ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf('msie') > -1) {
    return true;
  }
  return false;
}


function supportH5Video () {
  if (document.createElement('video').canPlayType) {
    return true;
  }
  return false;
}

// ============================================
// flash player

var FlashBridge = {

  videoInstanceMap: {},

  init: function() {
    var me = this;
    $.fn.jPlayer = function(methodName) {
      if (methodName === 'jPlayerFlashEvent') {
        var src = arguments[2].src;
        if (!src) { 
          return; 
        }
        var id = src.substring(src.lastIndexOf('?id=') + 4);
        var videoInfo = me.videoInstanceMap[id];
        videoInfo.eventHandle.call(videoInfo.instance, arguments);
      }
    }
  },

  regist: function (id, instance, eventHandle) {
    if (this.videoInstanceMap[id]) {
      console.error(id + ' is exists.');
      return;
    }
    this.videoInstanceMap[id] = {
      instance: instance, 
      eventHandle: eventHandle
    };
  }
};

FlashBridge.init();


function shimFlashVideo () {
  var me = this;
  var videoDom = me.videoDom;
  // 监听 flash 组件发出的事件
  FlashBridge.regist(me.id, me, function(args) {
      var me = this;
      var videoDom = me.videoDom;
      var eventName = args[1].substring(args[1].indexOf('_') + 1);
      var params = args[2];
      videoDom.duration = params.duration;
      videoDom.currentTime = params.currentTime;
      videoDom.bufferedEnd = params.seekPercent/100 * params.duration;
      if (eventName === 'ended') {
        playVideo.call(me, false);
        me.timer.stop();
        me.timer.clear();
      }
    });
  
  videoDom.play = function() {
    me.flashVideo.fl_play();
  };
  videoDom.pause = function() {
    me.flashVideo.fl_pause();
  };
  videoDom.buffered = {
    end: function() {
      return videoDom.bufferedEnd;
    }
  }
}


function videoDomReady (cb) {
  var me = this;
  if (me.flashVideo.fl_setVideo_m4v) {
    cb.call(me);
    return;
  }
  setTimeout(function() {
    videoDomReady.call(me, cb);
  }, 100);
}


function getFlashPluginVersion() {
  var version = 0,
    flash;
  if(window.ActiveXObject) {
    try {
      flash = new ActiveXObject("ShockwaveFlash.ShockwaveFlash");
      if (flash) {
        var v = flash.GetVariable("$version");
        if(v) {
          v = v.split(" ")[1].split(",");
          version = parseInt(v[0], 10) + "." + parseInt(v[1], 10);
        }
      }
    } catch(e) {}
  }
  else if(navigator.plugins && navigator.mimeTypes.length > 0) {
    flash = navigator.plugins["Shockwave Flash"];
    if(flash) {
      version = navigator.plugins["Shockwave Flash"].description.replace(/.*\s(\d+\.\d+).*/, "$1");
    }
  }
  return version * 1; // Converts to a number
}