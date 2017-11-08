$('document').ready(function()
{ 
     /* validation */
	 $("#change_form").validate({
      rules:
	  {
			text: {
            required: true
            },
            
            number: {
                required: true,
                number: true
                },
	   },
       messages:
	   {
            lastname:{
                      required: "(ex. Mocorro / Mocorro Jr / Mocorro III)"
                     },
            employee_id: "Enter your valid Employee number (ex. 12345)",
       },
	   submitHandler: submitForm	
       });  
	   /* validation */
	   
	   /* change submit */
	   function submitForm()
	   {		
			var data = $("#change_form").serialize();
			
			$.ajax({
				
			type : 'POST',
			url  : '/change/validate', // api url
			data : data,
			beforeSend: function()
			{	
				$("#error").fadeOut();
				$("#btn-change").prop("disabled",true);
				$("#btn-change").html('sending ...');
			},
			success :  function(response)
			   {						
					if(response=="ok"){

						$("#btn-change").html('Changing...');
						$("#btn-change").prop("disabled",true);
						setTimeout(' window.location.href = "/"; ',2000);
					}
					else{
									
						$("#error").fadeIn(1000, function(){						
							$("#error").html('<div class="alert alert-danger">'+response+' </div>');
							
							let counter = 10;
							let interval = setInterval(function(){
								counter--;
								$("#btn-change").html('Please wait in ' + counter + ' secs');

								if(counter !== 1){
									$("#btn-change").html('Please wait in ' + counter + ' secs');
								} else {
									$("#btn-change").html('Please wait in ' + counter + ' sec');
									clearInterval(interval);
								}
							},	1000);

							setTimeout(function(){
								$("#btn-change").prop("disabled",false);
								$("#btn-change").html('Try again');
							}, counter +'000');
							
							
                        });
                        
                        $("#employee_id").click(function() {
                            $(this).closest('form').find("input[type=text], textarea").val("");
                        });
					}
			  }
			});
				return false;
		}
	   /* change submit */	  
	   
});