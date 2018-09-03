var offsetBase = $("#chap1").offset().top + 1;
$(window).scroll(function()
{
	for(var i = 0;i < $('.sidemenu a').length-1 ; i++)
	{
		if(  $(window).scrollTop() > 0 
		&& $(window).scrollTop() + offsetBase >= $('#chap' + (i+1)).offset().top 
		&& $(window).scrollTop() + offsetBase < $('#chap' + (i+2)).offset().top)
		{
			$('.menuLi_selected').attr('class','menuLi');
			$("#menu" + (i+1) ).attr('class','menuLi_selected');
			break;
		}
		else if($(window).scrollTop() + offsetBase >= $('#chap' + $('.sidemenu a').length).offset().top)
		{
			$('.menuLi_selected').attr('class','menuLi');
			$("#menu" + $('.sidemenu a').length).attr('class','menuLi_selected');		
		}
	}
});

$(".sidemenu a").click(function()
{
	var target = this.getAttribute('move');
	var top = $(target).offset().top;
	var dis = Math.abs(top - offsetBase - $(window).scrollTop());
	
	$('html').animate( { scrollTop : top - offsetBase }, dis/3 );
});