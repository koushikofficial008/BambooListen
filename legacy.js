
const PLACEHOLDER_IMG="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23122218'/%3E%3Cpath d='M68 36v34.2A10.5 10.5 0 1 0 73 79V45h15v-9H68z' fill='%2310b981' opacity='0.75'/%3E%3C/svg%3E";
function escapeHtml(s){if(!s&&s!==0)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function getSafeTimestamp(t){if(!t)return 0;if(typeof t.toMillis==='function')return t.toMillis();if(t.seconds)return t.seconds*1000;var p=new Date(t).getTime();return isNaN(p)?0:p;}

(function initPerf(){try{var c=navigator.hardwareConcurrency||4,save=!!(navigator.connection&&navigator.connection.saveData);var low=save||c<=4;if(low)document.documentElement.classList.add('low-end-device');window.__BL_PERF={lowEnd:low,cores:c,saveData:save};}catch(_){window.__BL_PERF={lowEnd:false};}})();

let allSongs=[],searchResults=[],currentPlaylist=[],currentTrackIndex=-1,activeSongId=null,availableCategories=['Music','Phonk','Funk','Slowed'],currentPlaybackRate=1.0,isSeeking=false,currentView='home',isFullPlayerOpen=false,isInitialSongsLoaded=false,isAudioBuffering=false;
let trendingAutoSwipeTimer=null,trendingAutoSwipeIndex=0,trendingIsInteracting=false;
const navOrder=['home','search','console'],trackElement=document.getElementById('swipe-track'),audioMemoryCache=new Map();
let currentAudioBlobUrl=null,currentPlayPromise=null;
const audio=document.getElementById('audio-engine'),seekSlider=document.getElementById('pro-seek-slider'),progressBar=document.getElementById('pro-seek-progress'),bufferBar=document.getElementById('pro-seek-buffer');

function getSkeletonSongRowsHtml(c){c=c||5;let h='';for(let i=0;i<c;i++)h+=`<div class="skeleton-song-row"><div class="skeleton-art skeleton-shimmer"></div><div class="skeleton-info"><div class="skeleton-title skeleton-shimmer"></div><div class="skeleton-subtitle skeleton-shimmer"></div></div><div class="skeleton-btn skeleton-shimmer"></div></div>`;return h;}
function getSkeletonTrendingCardsHtml(c){c=c||3;let h='';for(let i=0;i<c;i++)h+=`<div class="skeleton-trending-card skeleton-shimmer"></div>`;return h;}
function showHomeSkeletons(){document.getElementById('trending-list').innerHTML=getSkeletonTrendingCardsHtml(3);document.getElementById('recent-songs-list').innerHTML=getSkeletonSongRowsHtml(3);document.getElementById('all-songs-list').innerHTML=getSkeletonSongRowsHtml(5);}
function showAllSkeletons(){showHomeSkeletons();document.getElementById('search-songs-list').innerHTML=getSkeletonSongRowsHtml(5);}
showAllSkeletons();

let currentTabIndex=0,touchStartX=0,touchStartY=0,touchMoveX=0,isGestureSwiping=null,startTrackTranslateX=0,isTouchActive=false,wasSwipePerformed=false,swipeClickTimer=null;
function getTrackWidth(){return document.getElementById('main-viewport').offsetWidth||window.innerWidth;}
function setTrackPosition(i,a){if(a===undefined)a=true;a?trackElement.classList.add('animating'):trackElement.classList.remove('animating');trackElement.style.transform=`translate3d(${-(i*100/3)}%,0,0)`;}
function setTrackDirectPixel(p){trackElement.classList.remove('animating');trackElement.style.transform=`translate3d(${p}px,0,0)`;}

function updateNavUI(t){
  document.getElementById('nav-btn-home').classList.toggle('active',t==='home');
  document.getElementById('nav-btn-search').classList.toggle('active',t==='search');
  document.getElementById('nav-btn-console').classList.toggle('active',t==='console');
  if(t==='search'){const q=document.getElementById('user-search-input').value;if(!q.trim())renderSearchList(allSongs);}
}

function navigateTo(v,p){
  if(p===undefined)p=true;
  if(isFullPlayerOpen)closeFullPlayer(false);
  const idx=navOrder.indexOf(v);
  if(idx!==-1){currentTabIndex=idx;currentView=v;setTrackPosition(currentTabIndex,true);updateNavUI(v);if(p)history.pushState({view:v,player:false},'',`#${v}`);}
}

function handleCustomBack(){
  if(isFullPlayerOpen){closeFullPlayer();}
  else if(currentView==='console'){navigateTo('search');}
  else if(currentView==='search'){navigateTo('home');}
  else{history.back();}
}

window.addEventListener('popstate',function(e){
  if(isFullPlayerOpen){closeFullPlayer(false);return;}
  if(e.state&&e.state.view)navigateTo(e.state.view,false);
  else navigateTo('home',false);
});
history.replaceState({view:'home',player:false},'','#home');

const touchArea=document.getElementById('main-viewport');
touchArea.addEventListener('touchstart',function(e){
  if(isFullPlayerOpen||e.target.closest('.trending-container,.pro-seekbar-container,input,select,textarea')){isTouchActive=false;return;}
  isTouchActive=true;isGestureSwiping=null;wasSwipePerformed=false;
  touchStartX=e.touches[0].clientX;touchStartY=e.touches[0].clientY;touchMoveX=touchStartX;
  startTrackTranslateX=-(currentTabIndex*getTrackWidth());
},{passive:true});

touchArea.addEventListener('touchmove',function(e){
  if(!isTouchActive)return;
  const cX=e.touches[0].clientX,cY=e.touches[0].clientY,dX=cX-touchStartX,dY=cY-touchStartY;
  if(isGestureSwiping===null&&Math.max(Math.abs(dX),Math.abs(dY))>8){isGestureSwiping=Math.abs(dX)>Math.abs(dY)*1.2;}
  if(isGestureSwiping===true){
    if(e.cancelable)e.preventDefault();
    wasSwipePerformed=true;touchMoveX=cX;let eff=dX;
    if((currentTabIndex===0&&dX>0)||(currentTabIndex===navOrder.length-1&&dX<0))eff=dX*0.28;
    setTrackDirectPixel(startTrackTranslateX+eff);
  }
},{passive:false});

touchArea.addEventListener('touchend',function(){
  if(!isTouchActive)return;isTouchActive=false;
  if(isGestureSwiping===true){
    const dX=touchMoveX-touchStartX,thresh=Math.min(getTrackWidth()*0.22,75);
    if(dX<-thresh&&currentTabIndex<navOrder.length-1)currentTabIndex++;
    else if(dX>thresh&&currentTabIndex>0)currentTabIndex--;
    currentView=navOrder[currentTabIndex];setTrackPosition(currentTabIndex,true);updateNavUI(currentView);
    history.replaceState({view:currentView,player:false},'',`#${currentView}`);
    clearTimeout(swipeClickTimer);
    swipeClickTimer=setTimeout(function(){wasSwipePerformed=false;},280);
  }else{setTrackPosition(currentTabIndex,true);}
  isGestureSwiping=null;
},{passive:true});

touchArea.addEventListener('touchcancel',function(){
  if(isTouchActive&&isGestureSwiping===true)setTrackPosition(currentTabIndex,true);
  isTouchActive=false;isGestureSwiping=null;wasSwipePerformed=false;
},{passive:true});

window.addEventListener('click',function(e){
  if(wasSwipePerformed){e.preventDefault();e.stopPropagation();if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();wasSwipePerformed=false;}
},true);

let searchTimer=null,currentSearchToken=0;
function debounceSearch(val){clearTimeout(searchTimer);searchTimer=setTimeout(function(){handleSearchInput(val);},260);}

function handleSearchInput(q){
  const cleanQ=(q||'').trim(),clr=document.getElementById('search-clear-btn');
  clr.style.display=cleanQ.length>0?'block':'none';
  const searchToken=++currentSearchToken;
  if(!cleanQ){
    searchResults=allSongs;
    const title=document.getElementById('search-status-title');
    if(title)title.innerHTML='Explore Songs<span id="search-results-count">'+allSongs.length+' Songs</span>';
    renderSearchList(searchResults);return;
  }
  const title=document.getElementById('search-status-title');
  if(title)title.innerHTML='Results for "'+escapeHtml(cleanQ)+'" <span id="search-results-count">Searching...</span>';
  searchSongs(cleanQ).then(function(found){
    if(searchToken!==currentSearchToken)return;
    searchResults=found;
    const cEl=document.getElementById('search-results-count');if(cEl)cEl.textContent=found.length+' found';
    renderSearchList(found);
  }).catch(function(){
    if(searchToken!==currentSearchToken)return;
    searchResults=[];
    const cEl=document.getElementById('search-results-count');if(cEl)cEl.textContent='Search unavailable';
    renderSearchList([]);
  });
}

function clearSearch(){
  const i=document.getElementById('user-search-input');i.value='';handleSearchInput('');i.focus();
}

function renderSearchList(sList){
  const el=document.getElementById('search-songs-list');
  if(!isInitialSongsLoaded){el.innerHTML=getSkeletonSongRowsHtml(4);return;}
  if(!sList||!sList.length){el.innerHTML=`<div class="empty-box"><i class="fa-solid fa-magnifying-glass"></i><br>No matching songs found</div>`;return;}
  el.innerHTML=sList.map(function(s){
    const cover=(s.thumbnailUrl||s.imageUrl||s.image||PLACEHOLDER_IMG);
    return `<div class="song-row ${activeSongId===s.id?'playing-row':''}" data-song-id="${s.id}" onclick="playSongById('${s.id}','search')">
      <img class="song-art" src="${escapeHtml(cover)}" alt="Art" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
      <div class="song-info"><h5>${escapeHtml(s.title||'Untitled')}</h5><p>${escapeHtml(s.category||'Soundscape')}</p></div>
      <div class="play-btn-circle"><i class="${activeSongId===s.id&&!audio.paused?'fa-solid fa-pause':'fa-solid fa-play'}"></i></div>
    </div>`;
  }).join('');
}

const homeScrollEl=document.getElementById('view-home'),ptrCircle=document.getElementById('ptr-circle'),ptrPath=document.getElementById('ptr-path'),ptrIcon=document.getElementById('ptr-icon');
let ptrTouchStartX=0,ptrTouchStartY=-1,isDraggingPTR=false,isPTRGestureLocked=false,pullDistance=0,isRefreshing=false;

homeScrollEl.addEventListener('touchstart',function(e){
  if(isRefreshing||currentTabIndex!==0)return;
  if(homeScrollEl.scrollTop<=2){ptrTouchStartX=e.touches[0].clientX;ptrTouchStartY=e.touches[0].clientY;isDraggingPTR=false;isPTRGestureLocked=false;}
  else{ptrTouchStartY=-1;}
},{passive:true});

homeScrollEl.addEventListener('touchmove',function(e){
  if(isRefreshing||currentTabIndex!==0||ptrTouchStartY<0)return;
  if(homeScrollEl.scrollTop>2){if(isDraggingPTR){isDraggingPTR=false;ptrCircle.style.opacity='0';ptrCircle.style.transform='translate3d(-50%,-75px,0)';}return;}
  const cX=e.touches[0].clientX,cY=e.touches[0].clientY,dX=cX-ptrTouchStartX,dY=cY-ptrTouchStartY;
  if(!isPTRGestureLocked){
    if(Math.max(Math.abs(dX),Math.abs(dY))>8){
      if(dY>8&&dY>Math.abs(dX)*1.5&&homeScrollEl.scrollTop<=2){isDraggingPTR=true;isPTRGestureLocked=true;}
      else{isDraggingPTR=false;isPTRGestureLocked=true;ptrCircle.style.opacity='0';ptrCircle.style.transform=`translate3d(-50%,-75px,0)`;return;}
    }
  }
  if(isDraggingPTR&&dY>0){
    pullDistance=Math.min(dY*0.42,90);ptrCircle.style.transition='none';
    ptrCircle.style.opacity=Math.min(pullDistance/30,1);
    ptrCircle.style.transform=`translate3d(-50%,${pullDistance-15}px,0)`;
    const p=Math.min(pullDistance/65,1);
    ptrPath.style.strokeDashoffset=100-(p*100);
    ptrIcon.style.transform=`rotate(${p*360}deg)`;
  }
},{passive:true});

homeScrollEl.addEventListener('touchend',async function(){
  ptrTouchStartY=-1;if(!isDraggingPTR||isRefreshing)return;
  isDraggingPTR=false;isPTRGestureLocked=false;
  if(pullDistance>=65){
    isRefreshing=true;ptrCircle.style.transition='transform 0.25s var(--ease-swipe),opacity 0.2s ease';
    ptrCircle.style.transform=`translate3d(-50%,42px,0)`;ptrCircle.style.opacity='1';
    ptrIcon.classList.add('ptr-refreshing');ptrPath.style.strokeDashoffset='0';
    showHomeSkeletons();
    try{await forceServerRefresh();showToast("Refreshed!");}
    catch(err){applyHomeContent();showToast("Synced!",false);}
    finally{ptrIcon.classList.remove('ptr-refreshing');ptrCircle.style.transform=`translate3d(-50%,-75px,0)`;ptrCircle.style.opacity='0';pullDistance=0;isRefreshing=false;}
  }else{
    ptrCircle.style.transition='transform 0.25s var(--ease-swipe),opacity 0.2s ease';
    ptrCircle.style.transform=`translate3d(-50%,-75px,0)`;ptrCircle.style.opacity='0';pullDistance=0;
  }
});

async function searchSongs(term){
  const q=(term||'').trim().toLowerCase();
  return allSongs.filter(function(song){
    return !q||(String(song.title||'').toLowerCase().includes(q)||String(song.category||'').toLowerCase().includes(q));
  });
}

function finishStartupLoading(){
  const app=document.getElementById('app-touch-surface'),loader=document.getElementById('startup-loader');
  if(app)app.style.visibility='visible';
  if(loader){loader.classList.add('done');setTimeout(function(){loader.remove();},260);}
}
function showStartupError(){
  const status=document.getElementById('startup-status'),retry=document.getElementById('startup-retry');
  if(status)status.textContent='Could not connect to the music library. Please check your connection.';
  if(retry)retry.hidden=false;
}

async function loadSongsFromApi(){
  try{
    const response=await fetch('https://bamboolisten-api.kynex.workers.dev/api/songs?status=approved',{headers:{'Accept':'application/json'}});
    if(!response.ok)throw new Error('Unable to load songs');
    const data=await response.json();
    allSongs=(data.songs||[]).map(function(s){
      const id=encodeURIComponent(s.id);
      return Object.assign({},s,{
        audioUrl:'https://bamboolisten-api.kynex.workers.dev/api/media/'+id+'?kind=audio',
        thumbnailUrl:'https://bamboolisten-api.kynex.workers.dev/api/media/'+id+'?kind=image',
        imageUrl:'https://bamboolisten-api.kynex.workers.dev/api/media/'+id+'?kind=image',
        trendingBannerUrl:'https://bamboolisten-api.kynex.workers.dev/api/media/'+id+'?kind=image'
      });
    });
    searchResults=allSongs;isInitialSongsLoaded=true;currentPlaylist=allSongs;
    applyHomeContent();
    if(document.getElementById('user-search-input')&&document.getElementById('user-search-input').value.trim())renderSearchList(allSongs);
    finishStartupLoading();
  }catch(err){
    if(!isInitialSongsLoaded){showStartupError();}
    else{applyHomeContent();if(document.getElementById('user-search-input')&&document.getElementById('user-search-input').value.trim())renderSearchList(searchResults);showToast('Unable to refresh songs. Check your connection.',true);}
  }
}

async function forceServerRefresh(){await loadSongsFromApi();}
document.getElementById('startup-retry').addEventListener('click',function(){
  this.hidden=true;
  document.getElementById('startup-status').textContent='Preparing your music library…';
  loadSongsFromApi();
});

function resetUserSessionState(){allSongs=[];currentPlaylist=[];currentTrackIndex=-1;activeSongId=null;isInitialSongsLoaded=false;isAudioBuffering=false;showAllSkeletons();}

const trContainer=document.getElementById('trending-list');
if(trContainer){
  trContainer.addEventListener('touchstart',function(){trendingIsInteracting=true;},{passive:true});
  trContainer.addEventListener('touchend',function(){setTimeout(function(){trendingIsInteracting=false;},2500);},{passive:true});
  trContainer.addEventListener('touchcancel',function(){trendingIsInteracting=false;},{passive:true});
}

function startTrendingAutoSwipe(){
  stopTrendingAutoSwipe();
  trendingAutoSwipeTimer=setInterval(function(){
    if(document.hidden||currentTabIndex!==0||trendingIsInteracting)return;
    const c=document.getElementById('trending-list');if(!c)return;
    const cards=c.querySelectorAll('.trending-card');if(!cards||cards.length<2)return;
    if(trendingAutoSwipeIndex>=cards.length)trendingAutoSwipeIndex=0;
    const card=cards[trendingAutoSwipeIndex];
    if(card){c.scrollTo({left:Math.max(0,card.offsetLeft-c.offsetLeft),behavior:(window.__BL_PERF&&window.__BL_PERF.lowEnd)?'auto':'smooth'});}
    trendingAutoSwipeIndex=(trendingAutoSwipeIndex+1)%cards.length;
  },3200);
}
function stopTrendingAutoSwipe(){if(trendingAutoSwipeTimer){clearInterval(trendingAutoSwipeTimer);trendingAutoSwipeTimer=null;}trendingAutoSwipeIndex=0;}

function applyHomeContent(){
  const trC=document.getElementById('trending-list'),trSongs=allSongs.filter(function(s){return s.isTrending===true;});
  if(!isInitialSongsLoaded)trC.innerHTML=getSkeletonTrendingCardsHtml(3);
  else if(!trSongs.length){stopTrendingAutoSwipe();trC.innerHTML=`<div class="empty-box" style="padding:16px 0;"><i class="fa-solid fa-fire-burner"></i><br>No featured trending songs</div>`;}
  else{
    trC.innerHTML=trSongs.map(function(song){
      const bannerUrl=(song.trendingBannerUrl||song.imageUrl||song.image||PLACEHOLDER_IMG);
      return `<div class="trending-card ${String(activeSongId)===String(song.id)&&!audio.paused?'playing-trending-card':''}" data-song-id="${song.id}" onclick="playSongById('${song.id}','home')">
        <img src="${escapeHtml(bannerUrl)}" alt="${escapeHtml(song.title||'Trending')}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
        <div class="trending-overlay"><span class="trending-badge"><i class="fa-solid fa-bolt"></i> TRENDING</span><h4>${escapeHtml(song.title||'Untitled')}</h4><p>${escapeHtml(song.category||'Featured')}</p></div>
      </div>`;
    }).join('');
    trendingAutoSwipeIndex=0;startTrendingAutoSwipe();
  }

  const rC=document.getElementById('recent-songs-list'),oneDay=Date.now()-(86400000);
  const rec=allSongs.filter(function(s){return getSafeTimestamp(s.submittedAt||s.createdAt)>=oneDay;});
  if(!isInitialSongsLoaded)rC.innerHTML=getSkeletonSongRowsHtml(3);
  else if(!rec.length)rC.innerHTML=`<div class="empty-box"><i class="fa-solid fa-clock-rotate-left"></i><br>No song uploaded in the last 24h</div>`;
  else rC.innerHTML=rec.map(function(s){
    const artUrl=(s.thumbnailUrl||s.imageUrl||s.image||PLACEHOLDER_IMG);
    return `<div class="song-row ${activeSongId===s.id?'playing-row':''}" data-song-id="${s.id}" onclick="playSongById('${s.id}','home')">
      <img class="song-art" src="${escapeHtml(artUrl)}" alt="Art" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
      <div class="song-info"><h5>${escapeHtml(s.title||'Untitled')}</h5><p>${escapeHtml(s.category||'Soundscape')}</p></div>
      <div class="play-btn-circle"><i class="${activeSongId===s.id&&!audio.paused?'fa-solid fa-pause':'fa-solid fa-play'}"></i></div>
    </div>`;
  }).join('');

  const allC=document.getElementById('all-songs-list');
  document.getElementById('songs-section-title').textContent=`All Songs (${allSongs.length})`;
  if(!isInitialSongsLoaded)allC.innerHTML=getSkeletonSongRowsHtml(5);
  else if(!allSongs.length)allC.innerHTML=`<div class="empty-box"><i class="fa-solid fa-music"></i><br>No songs found</div>`;
  else allC.innerHTML=allSongs.map(function(s){
    const artUrl=(s.thumbnailUrl||s.imageUrl||s.image||PLACEHOLDER_IMG);
    return `<div class="song-row ${activeSongId===s.id?'playing-row':''}" data-song-id="${s.id}" onclick="playSongById('${s.id}','home')">
      <img class="song-art" src="${escapeHtml(artUrl)}" alt="Art" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
      <div class="song-info"><h5>${escapeHtml(s.title||'Untitled')}</h5><p>${escapeHtml(s.category||'Soundscape')}</p></div>
      <div class="play-btn-circle"><i class="${activeSongId===s.id&&!audio.paused?'fa-solid fa-pause':'fa-solid fa-play'}"></i></div>
    </div>`;
  }).join('');
}

let playbackRequestToken=0;

function updateMediaSession(track){
  if(!('mediaSession' in navigator)||!track)return;
  try{
    navigator.mediaSession.metadata=new MediaMetadata({
      title:track.title||'Untitled',
      artist:track.artistName||track.category||'BambooListen',
      album:'BambooListen Music',
      artwork:[{src:track.imageUrl||track.thumbnailUrl||PLACEHOLDER_IMG,sizes:'512x512',type:'image/jpeg'}]
    });
    navigator.mediaSession.setActionHandler('play',function(){togglePlay();});
    navigator.mediaSession.setActionHandler('pause',function(){togglePlay();});
    navigator.mediaSession.setActionHandler('previoustrack',function(){playPrev();});
    navigator.mediaSession.setActionHandler('nexttrack',function(){playNext();});
    navigator.mediaSession.setActionHandler('seekto',function(d){if(d.seekTime&&!isNaN(d.seekTime))audio.currentTime=d.seekTime;});
  }catch(_){}
}

function playSongById(sId,sourceView){
  const source=sourceView||(currentView==='search'?'search':'home');
  const list=source==='search'?searchResults:allSongs;
  const idx=list.findIndex(function(s){return String(s.id)===String(sId);});
  if(idx===-1)return;
  const track=list[idx];
  const trackAudio=track.audioUrl||track.audio||'';
  const sameTrack=String(activeSongId)===String(track.id)&&!!audio.src&&audio.src===trackAudio;
  if(sameTrack){togglePlay();return;}
  currentPlaylist=list;
  currentTrackIndex=idx;
  activeSongId=track.id;
  loadAndPlayTrack(idx);
}

async function loadAndPlayTrack(idx){
  const playlist=currentPlaylist;
  if(idx<0||idx>=playlist.length)return;
  const reqToken=++playbackRequestToken;
  const track=playlist[idx];
  currentTrackIndex=idx;
  activeSongId=track.id;
  const trackAudio=(track.audioUrl||track.audio||''),trackCover=(track.imageUrl||track.image||PLACEHOLDER_IMG);

  updateBufferingUI(true);
  if(!trackAudio){updateBufferingUI(false);showToast('Audio source unavailable',true);return;}
  currentPlayPromise=null;
  audio.pause();
  if(currentAudioBlobUrl){try{URL.revokeObjectURL(currentAudioBlobUrl);}catch(_){}currentAudioBlobUrl=null;}
  try{audio.src=trackAudio;}catch(e){audio.src=trackAudio;}

  audio.playbackRate=currentPlaybackRate;
  document.getElementById('mini-art').src=trackCover;
  document.getElementById('mini-title').textContent=track.title||'Untitled';
  document.getElementById('mini-category').textContent=track.category||'Soundscape';
  document.getElementById('mini-player').style.display='flex';
  document.getElementById('player-art').src=trackCover;
  document.getElementById('player-title').textContent=track.title||'Untitled';
  document.getElementById('player-category').textContent=track.category||'Soundscape';
  progressBar.style.width='0%';bufferBar.style.width='0%';seekSlider.value=0;
  document.getElementById('current-time').textContent='0:00';
  document.getElementById('total-duration').textContent='0:00';
  updateMediaSession(track);
  updateAllSongRowIcons(true);

  let playPromise=null;
  try{
    if(reqToken!==playbackRequestToken)return;
    playPromise=audio.play();
    currentPlayPromise=playPromise;
    await playPromise;
    if(currentPlayPromise===playPromise)currentPlayPromise=null;
    if(reqToken!==playbackRequestToken)return;
    updateBufferingUI(false);
  }catch(e){
    if(currentPlayPromise===playPromise)currentPlayPromise=null;
    if(reqToken===playbackRequestToken)updateBufferingUI(false);
  }
}
function togglePlay(){
  if(!audio.src)return;
  if(audio.paused){
    updateBufferingUI(true);
    currentPlayPromise=audio.play();
    currentPlayPromise.then(function(){currentPlayPromise=null;updateBufferingUI(false);}).catch(function(){currentPlayPromise=null;updateBufferingUI(false);});
  }else{
    audio.pause();updateBufferingUI(false);
  }
}

function updateBufferingUI(b){
  isAudioBuffering=b;
  const mB=document.querySelector('#mini-play-btn'),fB=document.querySelector('#full-play-btn');
  const ic=b?'fa-solid fa-circle-notch fa-spin':(audio.paused?'fa-solid fa-play':'fa-solid fa-pause');
  if(mB)mB.innerHTML=`<i class="${ic}"></i>`;
  if(fB)fB.innerHTML=`<i class="${ic}"></i>`;
  updateAllSongRowIcons();
}

let lastRenderedRowState='';
function updateAllSongRowIcons(force){
  const state=activeSongId+'|'+(audio.paused?'paused':'playing')+'|'+(isAudioBuffering?'buffering':'ready');
  if(!force&&state===lastRenderedRowState)return;
  lastRenderedRowState=state;
  const rows=document.querySelectorAll('.song-row');
  const trendingCards=document.querySelectorAll('.trending-card');
  trendingCards.forEach(function(card){card.classList.toggle('playing-trending-card',card.getAttribute('data-song-id')===String(activeSongId)&&!audio.paused);});
  const activeIcon=isAudioBuffering?'fa-solid fa-circle-notch fa-spin':(audio.paused?'fa-solid fa-play':'fa-solid fa-pause');
  rows.forEach(function(row){
    const rId=row.getAttribute('data-song-id'),ic=row.querySelector('.play-btn-circle i');
    if(!ic)return;
    const active=rId===activeSongId;
    row.classList.toggle('playing-row',active);
    ic.className=active?activeIcon:'fa-solid fa-play';
  });
}

['waiting','stalled'].forEach(function(e){audio.addEventListener(e,function(){updateBufferingUI(true);});});
['playing','pause','canplay'].forEach(function(e){audio.addEventListener(e,function(){updateBufferingUI(false);document.getElementById('mini-player').classList.toggle('is-playing',!audio.paused);});});
audio.addEventListener('error',function(){
  const errorToken=playbackRequestToken;
  updateBufferingUI(false);showToast('Audio playback error, playing next...',true);
  setTimeout(function(){if(errorToken===playbackRequestToken&&currentPlaylist.length>1)playNext();},1000);
});

audio.addEventListener('progress',function(){
  if(audio.buffered.length>0&&!isNaN(audio.duration)&&audio.duration>0){
    bufferBar.style.width=`${Math.min((audio.buffered.end(audio.buffered.length-1)/audio.duration)*100,100)}%`;
  }
});

let audioUiFrame=0;
audio.addEventListener('timeupdate',function(){
  if(isSeeking||isNaN(audio.duration)||audio.duration<=0)return;
  if(!audioUiFrame){
    audioUiFrame=requestAnimationFrame(function(){
      audioUiFrame=0;
      if(isSeeking||isNaN(audio.duration)||audio.duration<=0)return;
      const p=(audio.currentTime/audio.duration)*100;
      progressBar.style.width=p+'%';seekSlider.value=p;
      document.getElementById('current-time').textContent=formatSeconds(audio.currentTime);
      document.getElementById('total-duration').textContent=formatSeconds(audio.duration);
    });
  }
});

function finishSeeking(){
  if(!isSeeking)return;
  if(!isNaN(audio.duration)&&audio.duration>0){audio.currentTime=(parseFloat(seekSlider.value)/100)*audio.duration;}
  isSeeking=false;
}
seekSlider.addEventListener('input',function(e){
  isSeeking=true;const val=parseFloat(e.target.value);
  progressBar.style.width=`${val}%`;
  if(!isNaN(audio.duration)&&audio.duration>0)document.getElementById('current-time').textContent=formatSeconds((val/100)*audio.duration);
});
seekSlider.addEventListener('change',finishSeeking);
seekSlider.addEventListener('touchend',finishSeeking,{passive:true});
seekSlider.addEventListener('touchcancel',function(){isSeeking=false;},{passive:true});
seekSlider.addEventListener('mouseup',finishSeeking);

const trackArea=document.getElementById('seekbar-track-area');
if(trackArea){
  trackArea.addEventListener('click',function(e){
    if(isNaN(audio.duration)||audio.duration<=0)return;
    const r=trackArea.getBoundingClientRect(),pct=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
    audio.currentTime=pct*audio.duration;progressBar.style.width=(pct*100)+'%';seekSlider.value=pct*100;
  });
}

function formatSeconds(sec){
  if(isNaN(sec)||!isFinite(sec))return '0:00';
  const m=Math.floor(sec/60),s=Math.floor(sec%60);
  return `${m}:${s<10?'0':''}${s}`;
}

function playNext(){
  if(!currentPlaylist.length)return;
  if(currentTrackIndex<currentPlaylist.length-1)loadAndPlayTrack(currentTrackIndex+1);
  else loadAndPlayTrack(0);
}
function playPrev(){
  if(!currentPlaylist.length)return;
  if(audio.currentTime>3)audio.currentTime=0;
  else if(currentTrackIndex>0)loadAndPlayTrack(currentTrackIndex-1);
  else loadAndPlayTrack(currentPlaylist.length-1);
}
audio.addEventListener('ended',playNext);

function openFullPlayer(){document.getElementById('full-player').style.display='flex';isFullPlayerOpen=true;history.pushState({view:currentView,player:true},'','#player');}
function closeFullPlayer(push){if(push===undefined)push=true;document.getElementById('full-player').style.display='none';closeSpeedMenu();isFullPlayerOpen=false;if(push&&location.hash==='#player')history.back();}
function toggleSpeedMenu(){const s=document.getElementById('speed-sheet'),b=document.getElementById('speed-backdrop');if(s.style.display==='flex')closeSpeedMenu();else{s.style.display='flex';b.style.display='block';}}
function closeSpeedMenu(){const s=document.getElementById('speed-sheet'),b=document.getElementById('speed-backdrop');if(s)s.style.display='none';if(b)b.style.display='none';}
function setPlaybackSpeed(s){
  currentPlaybackRate=s;audio.playbackRate=s;
  document.querySelectorAll('.speed-opt').forEach(function(el){el.classList.remove('active');});
  document.querySelectorAll('.speed-opt i').forEach(function(el){el.style.display='none';});
  const chk=document.getElementById('sp-'+s);
  const selectedOption=chk&&chk.closest('.speed-opt');
  if(selectedOption)selectedOption.classList.add('active');
  if(chk)chk.style.display='inline-block';
  closeSpeedMenu();showToast(`Speed set to ${s}x`);
}
function showToast(msg,isErr){
  if(isErr===undefined)isErr=false;
  const t=document.getElementById('toast');
  document.getElementById('toast-msg').textContent=msg;
  t.style.borderColor=isErr?'var(--danger)':'var(--primary)';
  const ic=t.querySelector('i');
  ic.className=isErr?'fa-solid fa-circle-exclamation':'fa-solid fa-circle-check';
  ic.style.color=isErr?'var(--danger)':'var(--primary)';
  t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},3000);
}


const uploadBackdrop=document.getElementById('upload-console-backdrop');
const uploadImageInput=document.getElementById('upload-song-image');
const uploadAudioInput=document.getElementById('upload-song-file');
function showSelectedUploadFile(input,pickerId,textId,defaultText){
  const picker=document.getElementById(pickerId),text=document.getElementById(textId),file=input.files&&input.files[0];
  picker.classList.toggle('has-file',!!file);
  text.textContent=file?file.name+' ('+(file.size/1024/1024).toFixed(2)+' MB)':defaultText;
  picker.title=file?file.name:defaultText;
}
uploadImageInput.addEventListener('change',function(){showSelectedUploadFile(this,'upload-image-picker','upload-image-picker-text','Choose Image');});
uploadAudioInput.addEventListener('change',function(){showSelectedUploadFile(this,'upload-audio-picker','upload-audio-picker-text','Choose MP3 File');});
function resetUploadProgress(){
  const wrap=document.getElementById('upload-progress-wrap');
  wrap.hidden=true;
  document.getElementById('upload-progress-fill').style.width='0%';
  document.getElementById('upload-progress-percent').textContent='0%';
  document.getElementById('upload-progress-label').textContent='Uploading...';
}
function openUploadConsole(){uploadBackdrop.style.display='flex';}
function showConsoleInfo(kind){
 const backdrop=document.getElementById('console-info-backdrop');
 const title=document.getElementById('console-info-title');
 const body=document.getElementById('console-info-body');
 if(kind==='terms'){
  title.textContent='Terms & Conditions';
  body.innerHTML='<p>By using BambooListen, you agree to these basic terms:</p><ul><li>Only upload audio and images that you own or have permission to share.</li><li>Do not upload unlawful, harmful, misleading, or infringing content.</li><li>Submitted songs may be reviewed by the administrator before publication.</li><li>Content that violates these terms may be edited or removed.</li><li>Use BambooListen respectfully and do not misuse the upload feature.</li></ul><p>These terms may be updated as the service changes.</p>';
 }else{
  title.textContent='About BambooListen';
  body.innerHTML='<p>BambooListen is a music listening platform for discovering and sharing music across categories such as music, phonk, funk, and slowed.</p><p>Listeners can explore approved songs, while users can submit tracks for administrator review.</p>';
 }
 backdrop.style.display='flex';
}
function closeConsoleInfo(){document.getElementById('console-info-backdrop').style.display='none';}
document.getElementById('console-info-backdrop').addEventListener('click',function(e){if(e.target===this)closeConsoleInfo();});
function closeUploadConsole(){uploadBackdrop.style.display='none';document.getElementById('song-upload-form').reset();document.getElementById('upload-progress').textContent='';showSelectedUploadFile(uploadImageInput,'upload-image-picker','upload-image-picker-text','Choose Image');showSelectedUploadFile(uploadAudioInput,'upload-audio-picker','upload-audio-picker-text','Choose MP3 File');resetUploadProgress();}
uploadBackdrop.addEventListener('click',function(e){if(e.target===uploadBackdrop)closeUploadConsole();});
document.getElementById('song-upload-form').addEventListener('submit',function(e){
  e.preventDefault();
  const form=e.currentTarget,submit=document.getElementById('upload-submit-btn'),progress=document.getElementById('upload-progress');
  const song=uploadAudioInput.files[0],image=uploadImageInput.files[0];
  const name=document.getElementById('upload-song-name').value.trim(),category=document.getElementById('upload-song-category').value;
  if(!name||!song||!image){showToast('Please complete all fields',true);return;}
  if(!/\.mp3$/i.test(song.name)||song.type&&song.type!=='audio/mpeg'&&song.type!=='audio/mp3'){showToast('Choose an MP3 song file',true);return;}
  if(song.size>10*1000*1000){showToast('Song must be 10 MB or smaller',true);return;}
  if(!/^image\/(jpeg|png|webp)$/.test(image.type)){showToast('Choose JPG, PNG or WEBP image',true);return;}
  if(image.size>1000*1000){showToast('Image must be 1 MB or smaller',true);return;}
  const body=new FormData();body.append('songName',name);body.append('category',category);body.append('isTrending',document.getElementById('upload-trending').checked?'true':'false');body.append('song',song);body.append('image',image);
  submit.disabled=true;progress.textContent='Preparing upload...';
  const wrap=document.getElementById('upload-progress-wrap'),fill=document.getElementById('upload-progress-fill'),percent=document.getElementById('upload-progress-percent'),label=document.getElementById('upload-progress-label');
  wrap.hidden=false;fill.style.width='0%';percent.textContent='0%';label.textContent='Uploading files...';
  const xhr=new XMLHttpRequest();
  xhr.open('POST','https://bamboolisten-api.kynex.workers.dev/api/upload');
  xhr.upload.addEventListener('progress',function(event){
    if(!event.lengthComputable)return;
    const value=Math.max(0,Math.min(100,Math.round((event.loaded/event.total)*100)));
    fill.style.width=value+'%';percent.textContent=value+'%';label.textContent=value>=100?'Processing upload...':'Uploading files...';
    progress.textContent='Uploading files and submitting for approval...';
  });
  xhr.addEventListener('load',function(){
    let result={};try{result=JSON.parse(xhr.responseText||'{}');}catch(_){}
    if(xhr.status<200||xhr.status>=300){uploadFailed(new Error(result.error||'Upload failed'));return;}
    fill.style.width='100%';percent.textContent='100%';label.textContent='Upload complete';
    progress.textContent='Uploaded successfully. Your song is pending admin approval.';
    showToast('Submitted for approval');
    setTimeout(closeUploadConsole,1400);
  });
  xhr.addEventListener('error',function(){uploadFailed(new Error('Network error. Please try again.'));});
  xhr.addEventListener('abort',function(){uploadFailed(new Error('Upload cancelled.'));});
  function uploadFailed(err){progress.textContent=err.message||'Upload failed';label.textContent='Upload failed';showToast(progress.textContent,true);submit.disabled=false;}
  xhr.addEventListener('loadend',function(){if(xhr.status>=200&&xhr.status<300)submit.disabled=false;});
  xhr.send(body);
});

setTimeout(function(){loadSongsFromApi();},0);

const canvas=document.getElementById('leaves-canvas');
const ctx=canvas?canvas.getContext('2d',{alpha:true}):null;
let leaves=[];
function resizeCanvas(){if(!canvas)return;canvas.width=window.innerWidth;canvas.height=window.innerHeight;}
window.addEventListener('resize',resizeCanvas,{passive:true});
resizeCanvas();

const perfProfile=window.__BL_PERF||{};
const leafCount=perfProfile.lowEnd?0:4;
if(canvas&&ctx&&leafCount>0){
  for(let i=0;i<leafCount;i++){
    leaves.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,size:Math.random()*6+6,speedY:Math.random()*0.4+0.25,rot:Math.random()*360,rotSpeed:(Math.random()-0.5)*0.55,opacity:Math.random()*0.16+0.08});
  }
  let lastFrameTime=0;
  function animateLeaves(ts){
    requestAnimationFrame(animateLeaves);
    if(document.hidden||isFullPlayerOpen||!leaves.length)return;
    if(ts-lastFrameTime<45)return;
    lastFrameTime=ts;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<leaves.length;i++){
      const l=leaves[i];l.y+=l.speedY;l.rot+=l.rotSpeed;
      if(l.y>canvas.height+25){l.y=-20;l.x=Math.random()*canvas.width;}
      ctx.save();ctx.translate(l.x,l.y);ctx.rotate(l.rot*Math.PI/180);ctx.beginPath();
      ctx.moveTo(0,-l.size);ctx.quadraticCurveTo(l.size*.4,0,0,l.size);ctx.quadraticCurveTo(-l.size*.4,0,0,-l.size);
      ctx.fillStyle=`rgba(52,211,153,${l.opacity})`;ctx.fill();ctx.restore();
    }
  }
  requestAnimationFrame(animateLeaves);
}
