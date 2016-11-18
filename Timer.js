/**
 * 定时器
 */

function Timer (interval) {
  this.interval = interval || 1000;
  this.handles = [];
}

/**
 * 开始执行定时器
 * @return {[type]} [description]
 */
Timer.prototype.start = function () {
  var interval = this.interval;
  if (isNaN(interval) || interval%1 !== 0 || interval <= 1) {
    console.error('interval must be a integer, %1===0, > 0');
    return;
  }
  // 定时器已经处于运转状态了，不需要再启动了
  if (this.running) {
    return;
  }

  this.running = true;
  startTimer.call(this);
}

/**
 * 停止定时器
 * @return {[type]} [description]
 */
Timer.prototype.stop = function () {
  this.running = false;
}

/**
 * 清空定时器执行的函数
 * @return {[type]} [description]
 */
Timer.prototype.clear = function () {
  this.handles = [];
}

/**
 * 添加定时执行的函数
 * @param {[type]} handle [description]
 */
Timer.prototype.add = function (handle) {
  if (typeof handle !== 'function') {
    console.error('handle must be a function.');
    return;
  }
  if (hasHandle.call(this, handle) !== -1) {
    return;
  }
  this.handles.push(handle);
}

/**
 * 移除定时执行的函数
 * @param  {[type]} handle [description]
 * @return {[type]}        [description]
 */
Timer.prototype.remove = function (handle) {
  var index = hasHandle.call(this, handle);
  if (index === -1) {
    return;
  }
  this.handles.splice(index, 1);
}

module.exports = Timer;

/**
 * 开始执行定时器
 * @return {[type]} [description]
 */
function startTimer () {
  var me = this;
  if (!me.running) {
    return;
  }

  var handle = null;
  for (var i = 0, len = me.handles.length; i < len; i++) {
    handle = me.handles[i];
    if (typeof handle === 'function') {
      handle();
    }
  }

  setTimeout(function() {
    startTimer.call(me);
  }, me.interval);
}


/**
 * 是否已经添加过这个函数了
 * @param  {[type]}  handle [description]
 * @return {Boolean}        [description]
 */
function hasHandle (handle) {
  var me = this;
  for (var i = 0, len = me.handles.length; i < len; i++) {
    if(me.handles[i] === handle) {
      return i;
    }
  }
  return -1;
}