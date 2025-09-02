//circle progress bar
function animateElements() {
    $('.progressbar').each(function () {
        var offset = $(this).offset();
        if (!offset) return; // Güvenlik kontrolü eklendi
        
        var elementPos = offset.top;
        var topOfWindow = $(window).scrollTop();
        var percent = $(this).find('.circle').attr('data-percent');
        var percentage = parseInt(percent, 10) / parseInt(100, 10);
        var animate = $(this).data('animate');
        if (elementPos < topOfWindow + $(window).height() - 30 && !animate) {
            $(this).data('animate', true);
            $(this).find('.circle').circleProgress({
                startAngle: -Math.PI / 2,
                value: percent / 100, 
                lineCap:"round",
                size: 180 ,
                }).on('circle-animation-progress', function (event, progress, stepValue) {
                $(this).find('div').text((stepValue*100).toFixed(1) + "%");
            }).stop();
        }
    });
}

// Show animated elements
animateElements();
$(window).scroll(animateElements);
    
// counter up   
   var a = 0;
   $(window).scroll(function() {
    var fablesCounter = $('.fables-counter');
    if (fablesCounter.length === 0) return;
    
    var offset = fablesCounter.offset();
    if (!offset) return; // Güvenlik kontrolü zaten var
    
    var oTop = offset.top - window.innerHeight;
    if (a == 0 && $(window).scrollTop() > oTop) {
      $('.fables-counter-value').each(function() {
        var $this = $(this),
          countTo = $this.attr('data-count');
        $({
          countNum: $this.text()
        }).animate({
            countNum: countTo
          },

          {
            duration: 4000,
            easing: 'swing',
            step: function() {
              $this.text(Math.floor(this.countNum));
            },
            complete: function() {
              $this.text(this.countNum);
              //alert('finished');
            }

          });
      });
      a = 1;
    }

   });   